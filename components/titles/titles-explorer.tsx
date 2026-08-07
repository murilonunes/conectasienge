import { CalendarDays, CircleDollarSign, FileSearch, Search, StickyNote } from "lucide-react";
import Link from "next/link";
import { I18nText } from "@/components/i18n/i18n-text";
import type { FinancialTitle, FinancialTitlesResult, TitleStatus } from "@/features/titles/data";
import { formatCompactCurrency, formatCurrency, formatOptionalDate } from "@/lib/formatters";

const statusLabels: Record<TitleStatus, string> = {
  overdue: "Em atraso",
  open: "Em aberto",
  settled: "Sem saldo",
  inclusion: "Em inclusão",
  incomplete: "Incompleto",
  unavailable: "Sem parcelas locais"
};

const statusClasses: Record<TitleStatus, string> = {
  overdue: "badge late",
  open: "badge pending",
  settled: "badge muted",
  inclusion: "badge pending",
  incomplete: "badge late",
  unavailable: "badge muted"
};

const originLabels: Record<string, string> = {
  AC: "Administração de compras",
  RA: "Administração de obras",
  AI: "Apuração de impostos",
  CO: "Comercial",
  CF: "Conhecimento de frete",
  CP: "Contas a pagar",
  ME: "Contratos e medições",
  MO: "Mão de obra",
  DV: "Devolução de nota fiscal",
  RF: "Financiamento bancário",
  FP: "Folha de pagamento",
  FE: "Frota de equipamentos",
  GI: "Guia de impostos",
  LO: "Locação de imóveis",
  SE: "Sistemas externos"
};

function documentLabel(item: FinancialTitle) {
  return [item.documentIdentificationId, item.documentNumber].filter(Boolean).join(" - ") || `Título #${item.billId}`;
}

function dateRange(item: FinancialTitle) {
  if (!item.firstDueDate) return "Não informado";
  if (!item.lastDueDate || item.lastDueDate === item.firstDueDate) return formatOptionalDate(item.firstDueDate);
  return `${formatOptionalDate(item.firstDueDate)} a ${formatOptionalDate(item.lastDueDate)}`;
}

function pageHref(result: FinancialTitlesResult, page: number) {
  const filters = result.filters;
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.direction !== "all") params.set("tipo", filters.direction);
  if (filters.status !== "all") params.set("situacao", filters.status);
  if (filters.company) params.set("empresa", filters.company);
  if (filters.origin) params.set("origem", filters.origin);
  if (filters.observation !== "all") params.set("observacao", filters.observation);
  if (filters.dateType !== "due") params.set("data", filters.dateType);
  if (filters.startDate) params.set("inicio", filters.startDate);
  if (filters.endDate) params.set("fim", filters.endDate);
  if (filters.sort !== "newest") params.set("ordem", filters.sort);
  if (page > 1) params.set("pagina", String(page));
  return `/titulos${params.size ? `?${params.toString()}` : ""}`;
}

function pageNumbers(page: number, totalPages: number) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  return Array.from(pages).filter((item) => item >= 1 && item <= totalPages).sort((left, right) => left - right);
}

export function TitlesExplorer({ result }: { result: FinancialTitlesResult }) {
  const firstItem = result.totalItems ? (result.page - 1) * result.pageSize + 1 : 0;
  const lastItem = Math.min(result.page * result.pageSize, result.totalItems);
  const pages = pageNumbers(result.page, result.totalPages);

  return (
    <>
      <div className="titles-summary" aria-label="Resumo dos títulos filtrados">
        <div><FileSearch aria-hidden="true" size={18} /><span><I18nText text="Títulos encontrados" /></span><strong>{result.totalItems.toLocaleString("pt-BR")}</strong><small><I18nText text="Contas a pagar e receber" /></small></div>
        <div><CircleDollarSign aria-hidden="true" size={18} /><span><I18nText text="Saldo em aberto" /></span><strong>{formatCompactCurrency(result.openAmount)}</strong><small><I18nText text="No resultado filtrado" /></small></div>
        <div className={result.overdueAmount > 0 ? "warn" : ""}><CalendarDays aria-hidden="true" size={18} /><span><I18nText text="Saldo vencido" /></span><strong>{formatCompactCurrency(result.overdueAmount)}</strong><small><I18nText text="Parcelas vencidas e com saldo" /></small></div>
        <div><StickyNote aria-hidden="true" size={18} /><span><I18nText text="Com observação" /></span><strong>{result.withObservation.toLocaleString("pt-BR")}</strong><small><I18nText text="Disponível nos títulos a pagar" /></small></div>
      </div>

      {result.warnings.map((warning) => <div className="card data-notice" key={warning}><strong><I18nText text="Fonte ainda não disponível" /></strong><span><I18nText text={warning} /></span></div>)}

      <form className="card titles-filters" method="get">
        <label className="titles-search-field">
          <span><I18nText text="Pesquisa geral" /></span>
          <div><Search aria-hidden="true" size={16} /><input data-i18n-placeholder="Título, documento, observação, empresa, credor ou cliente" defaultValue={result.filters.q} name="q" placeholder="Título, documento, observação, empresa, credor ou cliente" /></div>
        </label>
        <label><span><I18nText text="Tipo" /></span><select defaultValue={result.filters.direction} name="tipo"><option value="all"><I18nText text="A pagar e a receber" /></option><option value="payable"><I18nText text="A pagar" /></option><option value="receivable"><I18nText text="A receber" /></option></select></label>
        <label><span><I18nText text="Situação" /></span><select defaultValue={result.filters.status} name="situacao"><option value="all"><I18nText text="Todas as situações" /></option><option value="overdue"><I18nText text="Em atraso" /></option><option value="open"><I18nText text="Em aberto" /></option><option value="settled"><I18nText text="Sem saldo" /></option><option value="inclusion"><I18nText text="Em inclusão" /></option><option value="incomplete"><I18nText text="Incompleto" /></option><option value="unavailable"><I18nText text="Sem parcelas locais" /></option></select></label>
        <label><span><I18nText text="Empresa" /></span><select defaultValue={result.filters.company} name="empresa"><option value=""><I18nText text="Todas as empresas" /></option>{result.companies.map((company) => <option key={company.id} value={company.id}>{company.label}</option>)}</select></label>
        <label><span><I18nText text="Origem" /></span><select defaultValue={result.filters.origin} name="origem"><option value=""><I18nText text="Todas as origens" /></option>{result.origins.map((origin) => <option key={origin} value={origin}>{originLabels[origin] ? `${origin} - ${originLabels[origin]}` : origin}</option>)}</select></label>
        <label><span><I18nText text="Observação" /></span><select defaultValue={result.filters.observation} name="observacao"><option value="all"><I18nText text="Com ou sem observação" /></option><option value="with"><I18nText text="Somente com observação" /></option><option value="without"><I18nText text="Somente sem observação" /></option></select></label>
        <label><span><I18nText text="Data usada" /></span><select defaultValue={result.filters.dateType} name="data"><option value="due"><I18nText text="Primeiro vencimento" /></option><option value="issue"><I18nText text="Emissão" /></option></select></label>
        <label><span><I18nText text="De" /></span><input defaultValue={result.filters.startDate} name="inicio" type="date" /></label>
        <label><span><I18nText text="Até" /></span><input defaultValue={result.filters.endDate} name="fim" type="date" /></label>
        <label><span><I18nText text="Ordenar por" /></span><select defaultValue={result.filters.sort} name="ordem"><option value="newest"><I18nText text="Emissão mais recente" /></option><option value="due"><I18nText text="Próximo vencimento" /></option><option value="highest"><I18nText text="Maior saldo" /></option><option value="title"><I18nText text="Maior número do título" /></option></select></label>
        <div className="titles-filter-actions"><Link className="button secondary" href="/titulos"><I18nText text="Limpar" /></Link><button className="button" type="submit"><Search aria-hidden="true" size={15} /><I18nText text="Pesquisar" /></button></div>
      </form>

      <div className="titles-result-head">
        <div><strong>{firstItem.toLocaleString("pt-BR")} - {lastItem.toLocaleString("pt-BR")}</strong><span><I18nText text="de" /> {result.totalItems.toLocaleString("pt-BR")} <I18nText text="títulos" /></span></div>
        <small><I18nText text="Use # seguido do número para localizar um título exato." /></small>
      </div>

      <div className="card table-card titles-table-card">
        {result.items.length ? <div className="titles-table-scroll"><table className="titles-table">
          <thead><tr><th><I18nText text="Tipo / título" /></th><th><I18nText text="Empresa" /></th><th><I18nText text="Credor / cliente" /></th><th><I18nText text="Observação" /></th><th><I18nText text="Emissão" /></th><th><I18nText text="Vencimentos" /></th><th><I18nText text="Parcelas" /></th><th><I18nText text="Valor original" /></th><th><I18nText text="Saldo" /></th><th><I18nText text="Situação" /></th></tr></thead>
          <tbody>{result.items.map((item) => <tr key={item.key}>
            <td><span className={`title-direction ${item.direction}`}><I18nText text={item.direction === "payable" ? "A pagar" : "A receber"} /></span><strong>#{item.billId}</strong><small>{documentLabel(item)}</small>{item.originId && <small title={originLabels[item.originId] || item.originId}>{item.originId} - {originLabels[item.originId] || <I18nText text="Origem não identificada" />}</small>}</td>
            <td><strong>{item.companyName}</strong>{item.companyId && <small>#{item.companyId}</small>}</td>
            <td><strong>{item.partyName}</strong>{item.partyId && <small>#{item.partyId}</small>}</td>
            <td className="title-observation">{item.observation ? <span title={item.observation}>{item.observation}</span> : item.direction === "receivable" ? <small><I18nText text="Não fornecida pela integração" /></small> : <small><I18nText text="Sem observação" /></small>}</td>
            <td>{formatOptionalDate(item.issueDate)}</td>
            <td><strong>{dateRange(item)}</strong></td>
            <td><strong>{item.installmentCount.toLocaleString("pt-BR")}</strong></td>
            <td>{formatCurrency(item.originalAmount)}</td>
            <td><strong>{formatCurrency(item.openAmount)}</strong>{item.overdueAmount > 0 && <small className="title-overdue-amount">{formatCurrency(item.overdueAmount)} <I18nText text="vencido" /></small>}</td>
            <td><span className={statusClasses[item.status]}><I18nText text={statusLabels[item.status]} /></span></td>
          </tr>)}</tbody>
        </table></div> : <div className="empty-state"><FileSearch aria-hidden="true" size={28} /><strong><I18nText text="Nenhum título encontrado" /></strong><span><I18nText text="Revise os filtros ou atualize os dados financeiros em Configurações." /></span></div>}
      </div>

      {result.totalPages > 1 && <nav className="titles-pagination" aria-label="Paginação dos títulos">
        <Link aria-disabled={result.page === 1} className={result.page === 1 ? "disabled" : ""} href={pageHref(result, Math.max(1, result.page - 1))}><I18nText text="Anterior" /></Link>
        {pages.map((page, index) => <span key={page}>{index > 0 && page - pages[index - 1] > 1 && <i>...</i>}<Link aria-current={page === result.page ? "page" : undefined} className={page === result.page ? "active" : ""} href={pageHref(result, page)}>{page}</Link></span>)}
        <Link aria-disabled={result.page === result.totalPages} className={result.page === result.totalPages ? "disabled" : ""} href={pageHref(result, Math.min(result.totalPages, result.page + 1))}><I18nText text="Próxima" /></Link>
      </nav>}
    </>
  );
}
