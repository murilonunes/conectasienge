import { I18nText } from "@/components/i18n/i18n-text";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ReconciliationAccountPicker } from "@/components/settings/reconciliation-account-picker";
import { SiengeDumpImportControl } from "@/components/settings/sienge-dump-import-control";
import { SiengeUpdateControls } from "@/components/settings/sienge-update-controls";
import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { loadReconciliationAccounts } from "@/features/reconciliation/data";
import { getLocalDatabaseFiles, getSiengeScreenUpdateHistory, type ScreenUpdateHistory } from "@/lib/api/sienge-history";
import { getDumpImportStatus, getDumpSqliteInfo } from "@/lib/sienge-dump-import";
import { getAppSettings, saveAppSettings, type AppSettings } from "@/lib/settings";
import { updateAreas } from "@/lib/sienge-update-areas";
import { buildUpdateAreaStatuses } from "@/lib/sienge-update-status";

export const dynamic = "force-dynamic";

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
    inventoryCostCenterIds: asText(formData.get("inventoryCostCenterIds"), current.inventoryCostCenterIds),
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

export default function ConfiguracoesPage({ searchParams }: { searchParams?: { salvo?: string } }) {
  const settings = getAppSettings();
  const history = getSiengeScreenUpdateHistory();
  const databaseFiles = getLocalDatabaseFiles();
  const dumpImportStatus = getDumpImportStatus();
  const dumpSqliteInfo = getDumpSqliteInfo();
  const reconciliationAccounts = loadReconciliationAccounts();
  const selectedReconciliationAccounts = settings.reconciliationAccountNumbers
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const missingReconciliationAccounts = selectedReconciliationAccounts
    .filter((selected) => !reconciliationAccounts.some((account) => account.accountNumber === selected));
  const updateStatuses = buildUpdateAreaStatuses(history, updateAreas);
  const trackedUpdateAreas = updateAreas.filter((area) => area.historyKey);
  const trackedStatuses = trackedUpdateAreas.map((area) => updateStatuses[area.key]);
  const updatedScreens = trackedStatuses.filter((item) => item.status === "updated").length;
  const warningScreens = trackedStatuses.filter((item) => item.status === "warning").length;
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
          <strong><I18nText text={"Preferências salvas"} /></strong>
          <span><I18nText text={"As próximas aberturas das telas já usam os parâmetros atualizados."} /></span>
        </section>
      )}

      <div className="stats">
        <StatCard label="Áreas prontas" value={`${updatedScreens}/${trackedUpdateAreas.length}`} delta="Com dados salvos" icon="OK" />
        <StatCard label="Avisos" value={String(warningScreens)} delta="Últimas tentativas com erro ou limite" warn={warningScreens > 0} icon="!" />
        <StatCard label="Última integração" value={lastUpdatedAt ? formatDate(lastUpdatedAt).split(" ")[0] : "Nunca"} delta={lastUpdatedAt ? formatDate(lastUpdatedAt) : "Sem histórico"} icon="S" />
        <StatCard label="Dados salvos" value={sizeLabel} delta={`${databaseFiles.length} arquivo(s) de dados`} icon="DB" />
      </div>

      <section className="card settings-flow">
        <div>
          <strong><I18nText text={"Como o sistema trabalha agora"} /></strong>
          <span><I18nText text={"As telas abrem usando os dados já salvos."} /></span>
        </div>
        <div>
          <strong><I18nText text={"Quando atualizar"} /></strong>
          <span><I18nText text={"Use esta tela para buscar dados novos no Sienge."} /></span>
        </div>
        <div>
          <strong><I18nText text={"Proteção de dados fechados"} /></strong>
          <span><I18nText text={"Pagos, baixados e finalizados ficam preservados na atualização normal."} /></span>
        </div>
      </section>

      <section className="card data-notice">
        <strong><I18nText text={"Período de atualização ativo"} /></strong>
        <span><I18nText text={"As consultas com data buscam de"} /> {settings.siengeStartDate} <I18nText text={"até"} /> {settings.siengeEndDate}<I18nText text={". Ajuste abaixo em Preferências e salve antes de atualizar."} /></span>
      </section>

      <div className="settings-command-layout">
        <section className="card panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title"><I18nText text={"Atualizar dados"} /></h2>
              <span className="panel-note"><I18nText text={"Escolha uma área. A atualização roda em segundo plano e mostra o andamento abaixo."} /></span>
            </div>
          </div>
          <SiengeUpdateControls areas={updateAreas} statuses={updateStatuses} />
        </section>

        <section className="card panel settings-form-card">
          <div className="panel-head">
            <div>
              <h2 className="panel-title"><I18nText text={"Preferências de exibição"} /></h2>
              <span className="panel-note"><I18nText text={"Essas escolhas não consultam o Sienge."} /></span>
            </div>
          </div>
          <form action={saveSettingsAction} className="settings-form">
            <div className="settings-form-note">
              <strong><I18nText text={"Período usado para atualizar o Sienge"} /></strong>
              <span><I18nText text={"As consultas com data usam esse intervalo ao salvar os dados."} /></span>
            </div>
            <label>
              <I18nText text={"Data inicial da integração"} />
              <input name="siengeStartDate" type="date" defaultValue={settings.siengeStartDate} />
            </label>
            <label>
              <I18nText text={"Data final da integração"} />
              <input name="siengeEndDate" type="date" defaultValue={settings.siengeEndDate} />
            </label>
            <label>
              <I18nText text={"Nome exibido no topo"} />
              <input name="responsibleName" defaultValue={settings.responsibleName} />
            </label>
            <label>
              <I18nText text={"Função exibida"} />
              <input name="responsibleRole" defaultValue={settings.responsibleRole} />
            </label>
            <label>
              <I18nText text={"Iniciais"} />
              <input name="responsibleInitials" defaultValue={settings.responsibleInitials} maxLength={3} />
            </label>
            <label>
              <I18nText text={"Período inicial do dashboard"} />
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
              <I18nText text={"Meses futuros no contas a pagar"} />
              <select name="payablesFutureMonths" defaultValue={settings.payablesFutureMonths}>
                {[1, 2, 3, 4, 5, 6].map((months) => <option key={months} value={months}>{months} <I18nText text={"meses"} /></option>)}
              </select>
            </label>
            <label>
              <I18nText text={"Centros de custo para estoque avançado"} />
              <input name="inventoryCostCenterIds" defaultValue={settings.inventoryCostCenterIds} placeholder="Ex.: 1, 2, 15" data-i18n-placeholder={"Ex.: 1, 2, 15"} />
              <small><I18nText text={"Usado para consultar mapa imobiliário consolidado e insumos em estoque quando o Sienge exigir centro de custo."} /></small>
            </label>
            <ReconciliationAccountPicker
              accounts={reconciliationAccounts}
              missingAccounts={missingReconciliationAccounts}
              selectedAccounts={selectedReconciliationAccounts}
            />
            <label className="settings-check">
              <input name="showUpdateWarnings" type="checkbox" defaultChecked={settings.showUpdateWarnings} />
              <I18nText text={"Mostrar avisos quando alguma área não atualizar"} />
            </label>
            <button className="button" type="submit"><I18nText text={"Salvar preferências"} /></button>
          </form>
        </section>
      </div>

      <section className="card panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title"><I18nText text={"Histórico por portal"} /></h2>
            <span className="panel-note"><I18nText text={"Resumo da última integração registrada para cada visão."} /></span>
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
                <em>{item.successCount} <I18nText text={"atualizações -"} /> {item.errorCount} <I18nText text={"avisos"} /></em>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title"><I18nText text={"Importar dump do Sienge"} /></h2>
            <span className="panel-note"><I18nText text={"Use quando receber um arquivo .dmpc. Ele Ã© convertido para SQLite e passa a complementar os dados do sistema."} /></span>
          </div>
        </div>
        <SiengeDumpImportControl initialStatus={{ job: dumpImportStatus, sqlite: dumpSqliteInfo }} />
      </section>

      <section className="card panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title"><I18nText text={"Arquivos de dados"} /></h2>
            <span className="panel-note"><I18nText text={"Acompanhe o tamanho dos dados salvos por área."} /></span>
          </div>
        </div>
        <div className="settings-database-grid">
          {databaseFiles.length ? databaseFiles.map((file) => (
            <div key={file.name}>
              <strong>{file.name}</strong>
              <span>{file.sizeLabel}</span>
              <small><I18nText text={"Atualizado em"} /> {formatDate(file.updatedAt)}</small>
            </div>
          )) : <p className="empty-state"><I18nText text={"Nenhum arquivo de dados criado ainda."} /></p>}
        </div>
      </section>
    </>
  );
}
