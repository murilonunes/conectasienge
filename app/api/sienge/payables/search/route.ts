import { NextRequest, NextResponse } from "next/server";
import { contasPagarApi, credoresApi, type SiengeListFilters } from "@/lib/api/financeiro";
import { getSiengeCacheRevision, SiengeApiError } from "@/lib/api/sienge";

type PayableInstallment = {
  creditorId?: number;
  [key: string]: unknown;
};

type AdvancedSearchResult = {
  data?: PayableInstallment[];
  [key: string]: unknown;
};

type CachedSearch = {
  day: string;
  revision: number;
  savedAt: string;
  result: AdvancedSearchResult;
};

type Creditor = {
  id: number;
  cnpj?: string;
  cpf?: string;
};

const creditorCache = new Map<number, Creditor>();
const searchCache = new Map<string, CachedSearch>();
let creditorCacheDay = "";
let creditorLookupRetryAfter = 0;
const BULK_START_DATE = "2000-01-01";

function currentDay() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function bulkEndDate() {
  const today = new Date();
  return new Date(today.getFullYear() + 2, 11, 31).toISOString().slice(0, 10);
}

function itemDate(item: PayableInstallment, selectionType: string) {
  if (selectionType === "I") return String(item.issueDate || "");
  if (selectionType === "D") return String(item.dueDate || "");
  if (selectionType === "B") return String(item.billDate || item.installmentBaseDate || "");
  if (selectionType === "P") {
    const payments = Array.isArray(item.payments) ? item.payments as { paymentDate?: string }[] : [];
    return payments.some((payment) => payment.paymentDate) ? payments.map((payment) => payment.paymentDate).filter(Boolean).sort()[0] || "" : "";
  }
  return "";
}

function isInsideRequestedRange(item: PayableInstallment, selectionType: string, startDate: string, endDate: string) {
  if (selectionType === "P") {
    const payments = Array.isArray(item.payments) ? item.payments as { paymentDate?: string }[] : [];
    return payments.some((payment) => payment.paymentDate && payment.paymentDate >= startDate && payment.paymentDate <= endDate);
  }
  const date = itemDate(item, selectionType);
  return Boolean(date && date >= startDate && date <= endDate);
}

async function listCreditors(forceRefresh = false) {
  const day = currentDay();
  if (!forceRefresh && creditorLookupRetryAfter > Date.now()) return Array.from(creditorCache.values());
  if (!forceRefresh && creditorCache.size > 0 && creditorCacheDay === day) {
    return Array.from(creditorCache.values());
  }

  const page = await credoresApi.list<Creditor>({ limit: 200 }, forceRefresh);
  if (creditorCacheDay !== day || forceRefresh) creditorCache.clear();
  for (const creditor of page.results || []) creditorCache.set(creditor.id, creditor);
  creditorCacheDay = day;
  return page.results || [];
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");
  const selectionType = params.get("selectionType");
  const correctionIndexerId = Number(params.get("correctionIndexerId"));
  const correctionDate = params.get("correctionDate");
  const forceRefresh = params.get("forceRefresh") === "true";

  if (!startDate || !endDate || !correctionDate || !["I", "D", "P", "B"].includes(selectionType || "") || !Number.isInteger(correctionIndexerId) || correctionIndexerId <= 0) {
    return NextResponse.json({ message: "Informe período, tipo de data, indexador e data de correção válidos." }, { status: 400 });
  }

  const filters: SiengeListFilters = {
    startDate,
    endDate,
    selectionType: selectionType!,
    correctionIndexerId,
    correctionDate,
    withAuthorizations: params.get("withAuthorizations") === "true",
    withBankMovements: params.get("withBankMovements") !== "false"
  };
  for (const key of ["companyId", "buildingId", "buildingUnitId"]) {
    const value = params.get(key);
    if (value) filters[key] = Number(value);
  }
  const bulkFilters: SiengeListFilters = {
    ...filters,
    startDate: BULK_START_DATE,
    endDate: bulkEndDate()
  };
  const cacheKey = JSON.stringify(filters);
  const day = currentDay();
  const revision = getSiengeCacheRevision();
  const cached = searchCache.get(cacheKey);
  if (!forceRefresh && cached?.day === day && cached.revision === revision) {
    return NextResponse.json({
      ...cached.result,
      cacheInfo: { source: "cache", savedAt: cached.savedAt, day }
    });
  }
  if (cached && (cached.day !== day || cached.revision !== revision)) searchCache.delete(cacheKey);

  try {
    const result = await contasPagarApi.advancedSearch<AdvancedSearchResult>(bulkFilters, forceRefresh);
    const data = (result.data || []).filter((item) => isInsideRequestedRange(item, selectionType!, startDate, endDate));
    let creditorWarning: string | undefined;

    try {
      await listCreditors(forceRefresh);
    } catch (error) {
      creditorLookupRetryAfter = Date.now() + 2 * 60 * 1000;
      creditorWarning = error instanceof SiengeApiError && error.details.status === 429
        ? "Os títulos foram carregados, mas o Sienge limitou temporariamente a consulta de CNPJ."
        : "Os títulos foram carregados, mas não foi possível consultar os CNPJs dos credores.";
    }

    const responseResult = {
      ...result,
      creditorWarning,
      data: data.map((item) => ({
        ...item,
        creditorCnpj: item.creditorId ? creditorCache.get(item.creditorId)?.cnpj : undefined,
        creditorCpf: item.creditorId ? creditorCache.get(item.creditorId)?.cpf : undefined
      }))
    };
    const savedAt = new Date().toISOString();
    searchCache.set(cacheKey, { result: responseResult, savedAt, day, revision: getSiengeCacheRevision() });

    return NextResponse.json({
      ...responseResult,
      cacheInfo: { source: "sienge", savedAt, day }
    });
  } catch (error) {
    if (error instanceof SiengeApiError) {
      return NextResponse.json(error.details, { status: error.details.status || 502 });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : "Erro inesperado." }, { status: 500 });
  }
}
