import { NextRequest, NextResponse } from "next/server";
import {
  loadReceivablesForecast,
  receivableDocument,
  receivableOpenAmount,
  receivablePaidAmount,
  receivableStatus,
  type ReceivableInstallment
} from "@/features/receivables-forecast/sienge-data";

export const dynamic = "force-dynamic";

function asPositiveInteger(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function slimReceivableEntry(entry: ReceivableInstallment): ReceivableInstallment {
  return {
    companyName: entry.companyName,
    businessAreaName: entry.businessAreaName,
    projectId: entry.projectId,
    projectName: entry.projectName,
    clientId: entry.clientId,
    clientName: entry.clientName,
    billId: entry.billId,
    receivableBillId: entry.receivableBillId,
    installmentId: entry.installmentId,
    documentIdentificationId: entry.documentIdentificationId,
    documentNumber: entry.documentNumber,
    documentForecast: entry.documentForecast,
    originalAmount: entry.originalAmount,
    balanceAmount: entry.balanceAmount,
    correctedBalanceAmount: entry.correctedBalanceAmount,
    dueDate: entry.dueDate,
    mainUnit: entry.mainUnit,
    installmentNumber: entry.installmentNumber,
    receipts: entry.receipts?.map((receipt) => ({
      grossAmount: receipt.grossAmount,
      netAmount: receipt.netAmount
    })),
    __siengeIntegrationDay: entry.__siengeIntegrationDay,
    __siengeIntegratedAt: entry.__siengeIntegratedAt
  };
}

function matchesSearch(entry: ReceivableInstallment, search: string) {
  if (!search) return true;
  const text = [
    receivableDocument(entry),
    entry.billId,
    entry.receivableBillId,
    entry.installmentId,
    entry.clientName,
    entry.clientId,
    entry.projectName,
    entry.businessAreaName,
    entry.mainUnit,
    entry.companyName
  ].filter(Boolean).join(" ").toLowerCase();
  return text.includes(search);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = asPositiveInteger(params.get("page"), 1, 100000);
  const pageSize = asPositiveInteger(params.get("pageSize"), 100, 500);
  const search = String(params.get("search") || "").trim().toLowerCase();
  const status = String(params.get("status") || "");

  const forecast = await loadReceivablesForecast();
  if (forecast.error) {
    return NextResponse.json({ message: forecast.error.explanation || forecast.error.title }, { status: 404 });
  }

  const statuses = Array.from(new Set(forecast.forecastEntries.map((entry) => receivableStatus(entry)))).sort();
  const filtered = forecast.forecastEntries.filter((entry) =>
    matchesSearch(entry, search)
    && (!status || receivableStatus(entry) === status)
  );
  const filteredCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize).map(slimReceivableEntry);

  return NextResponse.json({
    items,
    totalEntries: forecast.forecastEntries.length,
    filteredCount,
    totalOpen: filtered.reduce((sum, entry) => sum + receivableOpenAmount(entry), 0),
    totalReceived: filtered.reduce((sum, entry) => sum + receivablePaidAmount(entry), 0),
    statuses,
    page: currentPage,
    pageSize,
    totalPages
  });
}
