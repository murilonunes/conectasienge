import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ReconciliationAccountPicker } from "@/components/settings/reconciliation-account-picker";
import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { loadPayables } from "@/features/financeiro/sienge-data";
import { loadInventoryAssets } from "@/features/inventory/data";
import { loadPayablesSchedule } from "@/features/payables-schedule/data";
import { loadPurchases } from "@/features/purchases/data";
import { loadReceivablesForecast } from "@/features/receivables-forecast/sienge-data";
import { loadReconciliationAccounts, loadReconciliationMovements } from "@/features/reconciliation/data";
import { loadSalesContracts } from "@/features/sales/data";
import { getLocalDatabaseFiles, getSiengeScreenUpdateHistory, type ScreenUpdateHistory } from "@/lib/api/sienge-history";
import { getAppSettings, getSiengeIntegrationRange, saveAppSettings, type AppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type UpdateArea = "all" | "payables" | "receivables" | "sales" | "inventory" | "purchases" | "reconciliation";

const updateAreas: Array<{ key: UpdateArea; label: string; note: string; historyKey?: string }> = [
  { key: "all", label: "Todas as áreas", note: "Atualiza todos os dados usados pelos portais." },
  { key: "payables", label: "Contas a pagar", note: "Títulos, parcelas, agenda e busca avançada.", historyKey: "payables" },
  { key: "receivables", label: "Contas a receber", note: "Previsão de recebimentos e parcelas em aberto.", historyKey: "receivables" },
  { key: "sales", label: "Vendas", note: "Contratos de vendas e gráficos comerciais.", historyKey: "sales" },
  { key: "inventory", label: "Estoque e patrimônio", note: "Unidades imobiliárias, bens móveis e bens imóveis.", historyKey: "inventory" },
  { key: "purchases", label: "Compras", note: "Solicitações, cotações, pedidos e notas.", historyKey: "purchases" },
  { key: "reconciliation", label: "Conciliação", note: "Movimentos bancários e itens a conciliar.", historyKey: "reconciliation" }
];

function asText(value: FormDataEntryValue | null, fallback: string) {
  const text = String(value || "").trim();
  return text || fallback;
}

function asNumber(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function selectedValues(formData: FormData, key: string) {
  return formData.getAll(key)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join(",");
}

async function saveSettingsAction(formData: FormData) {
  "use server";
  const current = getAppSettings();
  const next: Partial<AppSettings> = {
    responsibleName: asText(formData.get("responsibleName"), current.responsibleName),
    responsibleRole: asText(formData.get("responsibleRole"), current.responsibleRole),
    responsibleInitials: asText(formData.get("responsibleInitials"), current.responsibleInitials).toUpperCase(),
    dashboardDays: asNumber(formData.get("dashboardDays"), current.dashboardDays),
    siengeStartDate: asText(formData.get("siengeStartDate"), current.siengeStartDate),
    siengeEndDate: asText(formData.get("siengeEndDate"), current.siengeEndDate),
    payablesFutureMonths: asNumber(formData.get("payablesFutureMonths"), current.payablesFutureMonths),
    reconciliationAccountNumbers: selectedValues(formData, "reconciliationAccountNumbers"),
    showUpdateWarnings: formData.get("showUpdateWarnings") === "on"
  };

  saveAppSettings(next);
  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/contas-pagar");
  revalidatePath("/conciliacao");
  revalidatePath("/configuracoes");
  redirect("/configuracoes?salvo=1");
}

async function updateSiengeAreaAction(formData: FormData) {
  "use server";
  const area = String(formData.get("area") || "all") as UpdateArea;
  const force = formData.get("force") === "true";
  const integrationRange = getSiengeIntegrationRange();

  if (area === "payables" || area === "all") {
    await Promise.allSettled([loadPayables(true, force, integrationRange), loadPayablesSchedule(true, force, integrationRange)]);
  }
  if (area === "receivables" || area === "all") await loadReceivablesForecast(true, force, integrationRange);
  if (area === "sales" || area === "all") await loadSalesContracts(true, force);
  if (area === "inventory" || area === "all") await loadInventoryAssets(true, force);
  if (area === "purchases" || area === "all") await loadPurchases(true, force, integrationRange);
  if (area === "reconciliation" || area === "all") await loadReconciliationMovements(undefined, true, force, integrationRange);

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/contas-pagar");
  revalidatePath("/contas-receber");
  revalidatePath("/sales");
  revalidatePath("/estoque");
  revalidatePath("/compras");
  revalidatePath("/conciliacao");
  revalidatePath("/configuracoes");
  redirect(`/configuracoes?atualizado=${encodeURIComponent(area)}&modo=${force ? "forca" : "normal"}`);
}

function formatDate(value?: string) {
  if (!value) return "Nunca atualizado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function statusLabel(status: ScreenUpdateHistory["status"]) {
  if (status === "updated") return "Pronto";
  if (status === "warning") return "Com aviso";
  return "Sem dados";
}

function areaStatus(history: ScreenUpdateHistory[], area: (typeof updateAreas)[number]) {
  if (area.key === "all") {
    const updated = history.filter((item) => item.status === "updated").length;
    const warning = history.filter((item) => item.status === "warning").length;
    return {
      status: warning ? "warning" as const : updated ? "updated" as const : "empty" as const,
      lastUpdatedAt: history.map((item) => item.lastUpdatedAt).filter(Boolean).sort().at(-1),
      description: `${updated} de ${history.length} áreas com dados salvos`,
      successCount: history.reduce((sum, item) => sum + item.successCount, 0),
      errorCount: history.reduce((sum, item) => sum + item.errorCount, 0)
    };
  }
  const item = history.find((entry) => entry.key === area.historyKey);
  return {
    status: item?.status || "empty" as const,
    lastUpdatedAt: item?.lastUpdatedAt,
    description: item?.description || area.note,
    successCount: item?.successCount || 0,
    errorCount: item?.errorCount || 0
  };
}

export default function ConfiguracoesPage({ searchParams }: { searchParams?: { salvo?: string; atualizado?: string; modo?: string } }) {
  const settings = getAppSettings();
  const history = getSiengeScreenUpdateHistory();
  const databaseFiles = getLocalDatabaseFiles();
  const reconciliationAccounts = loadReconciliationAccounts();
  const selectedReconciliationAccounts = settings.reconciliationAccountNumbers
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const missingReconciliationAccounts = selectedReconciliationAccounts
    .filter((selected) => !reconciliationAccounts.some((account) => account.accountNumber === selected));
  const updatedScreens = history.filter((item) => item.status === "updated").length;
  const warningScreens = history.filter((item) => item.status === "warning").length;
  const totalDatabaseSize = databaseFiles.reduce((sum, file) => sum + file.sizeBytes, 0);
  const sizeLabel = totalDatabaseSize >= 1024 * 1024
    ? `${(totalDatabaseSize / 1024 / 1024).toFixed(1)} MB`
    : `${(totalDatabaseSize / 1024).toFixed(1)} KB`;
  const lastUpdatedAt = history.map((item) => item.lastUpdatedAt).filter(Boolean).sort().at(-1);

  return (
    <>
      <PageHeading
        eyebrow="Central de dados"
        title="Configurações"
        subtitle="Atualize os dados do Sienge, acompanhe a última integração e ajuste a exibição dos portais."
      />

      {searchParams?.salvo && (
        <section className="card data-notice">
          <strong>Preferências salvas</strong>
          <span>As próximas aberturas das telas já usam os parâmetros atualizados.</span>
        </section>
      )}

      {searchParams?.atualizado && (
        <section className="card data-notice">
          <strong>Atualização concluída</strong>
          <span>
            Os dados foram atualizados e salvos para uso nas telas. {searchParams.modo === "forca"
              ? "A atualização com força também pode substituir registros finalizados."
              : "Registros pagos, baixados ou finalizados foram preservados quando identificados."}
          </span>
        </section>
      )}

      <div className="stats">
        <StatCard label="Áreas prontas" value={`${updatedScreens}/${history.length}`} delta="Com dados salvos" icon="OK" />
        <StatCard label="Avisos" value={String(warningScreens)} delta="Últimas tentativas com erro ou limite" warn={warningScreens > 0} icon="!" />
        <StatCard label="Última integração" value={lastUpdatedAt ? formatDate(lastUpdatedAt).split(" ")[0] : "Nunca"} delta={lastUpdatedAt ? formatDate(lastUpdatedAt) : "Sem histórico"} icon="S" />
        <StatCard label="Dados salvos" value={sizeLabel} delta={`${databaseFiles.length} arquivo(s) de dados`} icon="DB" />
      </div>

      <section className="card settings-flow">
        <div>
          <strong>Como o sistema trabalha agora</strong>
          <span>As telas abrem usando os dados já salvos.</span>
        </div>
        <div>
          <strong>Quando atualizar</strong>
          <span>Use esta tela para buscar dados novos no Sienge.</span>
        </div>
        <div>
          <strong>Proteção de dados fechados</strong>
          <span>Pagos, baixados e finalizados ficam preservados na atualização normal.</span>
        </div>
      </section>

      <section className="card data-notice">
        <strong>Período de atualização ativo</strong>
        <span>As consultas com data buscam de {settings.siengeStartDate} até {settings.siengeEndDate}. Ajuste abaixo em Preferências e salve antes de atualizar.</span>
      </section>

      <div className="settings-command-layout">
        <section className="card panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Atualizar dados</h2>
              <span className="panel-note">Escolha uma área. A atualização pode levar alguns minutos quando o período for grande.</span>
            </div>
          </div>
          <div className="settings-area-grid">
            {updateAreas.map((area) => {
              const current = areaStatus(history, area);
              return (
                <article key={area.key} className={`settings-area-card ${current.status}`}>
                  <div className="settings-area-main">
                    <span>{statusLabel(current.status)}</span>
                    <strong>{area.label}</strong>
                    <p>{area.note}</p>
                    <small>Última integração: {formatDate(current.lastUpdatedAt)}</small>
                    <em>{current.successCount} atualizações - {current.errorCount} avisos</em>
                  </div>
                  <div className="settings-area-actions">
                    <form action={updateSiengeAreaAction}>
                      <input type="hidden" name="area" value={area.key} />
                      <input type="hidden" name="force" value="false" />
                      <button className="button" type="submit">Atualizar</button>
                    </form>
                    <form action={updateSiengeAreaAction}>
                      <input type="hidden" name="area" value={area.key} />
                      <input type="hidden" name="force" value="true" />
                      <button className="button secondary" type="submit">Atualizar com força</button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="card panel settings-form-card">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Preferências de exibição</h2>
              <span className="panel-note">Essas escolhas não consultam o Sienge.</span>
            </div>
          </div>
          <form action={saveSettingsAction} className="settings-form">
            <div className="settings-form-note">
              <strong>Período usado para atualizar o Sienge</strong>
              <span>As consultas com data usam esse intervalo ao salvar os dados.</span>
            </div>
            <label>
              Data inicial da integração
              <input name="siengeStartDate" type="date" defaultValue={settings.siengeStartDate} />
            </label>
            <label>
              Data final da integração
              <input name="siengeEndDate" type="date" defaultValue={settings.siengeEndDate} />
            </label>
            <label>
              Nome exibido no topo
              <input name="responsibleName" defaultValue={settings.responsibleName} />
            </label>
            <label>
              Função exibida
              <input name="responsibleRole" defaultValue={settings.responsibleRole} />
            </label>
            <label>
              Iniciais
              <input name="responsibleInitials" defaultValue={settings.responsibleInitials} maxLength={3} />
            </label>
            <label>
              Período inicial do dashboard
              <select name="dashboardDays" defaultValue={settings.dashboardDays}>
                {[
                  [7, "7 dias"],
                  [15, "15 dias"],
                  [30, "30 dias"],
                  [60, "60 dias"],
                  [90, "90 dias"],
                  [180, "6 meses"],
                  [365, "12 meses"],
                  [730, "24 meses"],
                  [1095, "36 meses"],
                  [1460, "48 meses"],
                  [1825, "60 meses"]
                ].map(([days, label]) => <option key={days} value={days}>{label}</option>)}
              </select>
            </label>
            <label>
              Meses futuros no contas a pagar
              <select name="payablesFutureMonths" defaultValue={settings.payablesFutureMonths}>
                {[1, 2, 3, 4, 5, 6].map((months) => <option key={months} value={months}>{months} meses</option>)}
              </select>
            </label>
            <ReconciliationAccountPicker
              accounts={reconciliationAccounts}
              missingAccounts={missingReconciliationAccounts}
              selectedAccounts={selectedReconciliationAccounts}
            />
            <label className="settings-check">
              <input name="showUpdateWarnings" type="checkbox" defaultChecked={settings.showUpdateWarnings} />
              Mostrar avisos quando alguma área não atualizar
            </label>
            <button className="button" type="submit">Salvar preferências</button>
          </form>
        </section>
      </div>

      <section className="card panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Histórico por portal</h2>
            <span className="panel-note">Resumo da última integração registrada para cada visão.</span>
          </div>
        </div>
        <div className="settings-history-list">
          {history.map((item) => (
            <article key={item.key} className={`settings-history-item ${item.status}`}>
              <div>
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </div>
              <div>
                <b>{statusLabel(item.status)}</b>
                <small>{formatDate(item.lastUpdatedAt)}</small>
                <em>{item.successCount} atualizações - {item.errorCount} avisos</em>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Arquivos de dados</h2>
            <span className="panel-note">Acompanhe o tamanho dos dados salvos por área.</span>
          </div>
        </div>
        <div className="settings-database-grid">
          {databaseFiles.length ? databaseFiles.map((file) => (
            <div key={file.name}>
              <strong>{file.name}</strong>
              <span>{file.sizeLabel}</span>
              <small>Atualizado em {formatDate(file.updatedAt)}</small>
            </div>
          )) : <p className="empty-state">Nenhum arquivo de dados criado ainda.</p>}
        </div>
      </section>
    </>
  );
}
