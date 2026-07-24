"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { useMemo, useState } from "react";
import { LocalDataList } from "@/components/ui/local-data-list";
import { analyzePayableCharge, type PayableChargeForReview } from "@/lib/payables-abuse-analysis";
import { formatCurrency } from "@/lib/formatters";

type CreditorChargeItem = PayableChargeForReview & {
  creditorId?: number;
  creditorName?: string;
  creditorCnpj?: string;
  creditorCpf?: string;
  billId: number;
  installmentId: number;
};

type CreditorAbuseGroup = {
  key: string;
  creditor: string;
  document: string;
  count: number;
  originalAmount: number;
  correctedAmount: number;
  paidAmount: number;
  paidIncrease: number;
  possibleExcess: number;
  percent: number;
};

type PayablesAbuseDashboardModalProps = {
  items: CreditorChargeItem[];
  referenceDate?: string;
};

function creditorDocument(item: CreditorChargeItem) {
  return item.creditorCnpj || item.creditorCpf || "";
}

function creditorName(item: CreditorChargeItem) {
  return item.creditorName || `Credor #${item.creditorId || "não informado"}`;
}

function groupKey(item: CreditorChargeItem) {
  return String(item.creditorId || creditorDocument(item) || creditorName(item));
}

export function PayablesAbuseDashboardModal({ items, referenceDate }: PayablesAbuseDashboardModalProps) {
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => {
    const grouped = new Map<string, CreditorAbuseGroup>();

    items.forEach((item) => {
      const review = analyzePayableCharge(item, referenceDate);
      if (!review.hasRisk) return;

      const key = groupKey(item);
      const current = grouped.get(key) || {
        key,
        creditor: creditorName(item),
        document: creditorDocument(item),
        count: 0,
        originalAmount: 0,
        correctedAmount: 0,
        paidAmount: 0,
        paidIncrease: 0,
        possibleExcess: 0,
        percent: 0
      };
      current.count += 1;
      current.originalAmount += review.originalAmount;
      current.correctedAmount += review.correctedAmount;
      current.paidAmount += review.paidAmount;
      current.paidIncrease += review.paidIncrease;
      current.possibleExcess += Math.max(review.correctedExcess, review.paidExcess);
      grouped.set(key, current);
    });

    const rows = Array.from(grouped.values()).sort((left, right) => right.possibleExcess - left.possibleExcess);
    const total = rows.reduce((sum, row) => sum + row.possibleExcess, 0);
    return rows.map((row) => ({
      ...row,
      percent: total > 0 ? row.possibleExcess / total * 100 : 0
    }));
  }, [items, referenceDate]);

  const topTen = groups.slice(0, 10);
  const totalExcess = groups.reduce((sum, row) => sum + row.possibleExcess, 0);
  const totalInstallments = groups.reduce((sum, row) => sum + row.count, 0);
  const maxExcess = Math.max(1, ...topTen.map((row) => row.possibleExcess));

  return (
    <>
      <button className="button secondary advanced-search-button" type="button" disabled={!groups.length} onClick={() => setOpen(true)}>
        <I18nText text={"Dashboard de cobranças abusivas"} />
      </button>

      {open && (
        <div className="settings-modal-backdrop" role="presentation">
          <div className="settings-modal payable-abuse-dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="payable-abuse-dashboard-title">
            <div className="settings-modal-head">
              <div>
                <h2 id="payable-abuse-dashboard-title"><I18nText text={"Dashboard de cobranças abusivas"} /></h2>
                <span><I18nText text={"Agrupado por credor e ordenado pela soma do possível excesso."} /></span>
              </div>
              <button type="button" onClick={() => setOpen(false)}><I18nText text={"Fechar"} /></button>
            </div>

            <div className="payable-abuse-summary">
              <div><span><I18nText text={"Possível excesso total"} /></span><strong>{formatCurrency(totalExcess)}</strong></div>
              <div><span><I18nText text={"Credores com alerta"} /></span><strong>{groups.length}</strong></div>
              <div><span><I18nText text={"Parcelas em revisão"} /></span><strong>{totalInstallments}</strong></div>
            </div>

            <section className="payable-abuse-chart">
              <div className="panel-head">
                <div>
                  <h3 className="panel-title"><I18nText text={"10 maiores por possível excesso"} /></h3>
                  <span className="panel-note"><I18nText text={"% sobre o total encontrado e valor agrupado por credor."} /></span>
                </div>
              </div>
              {topTen.length ? topTen.map((row) => (
                <div className="payable-abuse-chart-row" key={row.key}>
                  <div>
                    <strong>{row.creditor}</strong>
                    <span>{row.document || <I18nText text={"Documento não informado"} />} <I18nText text={"-"} /> {row.count} <I18nText text={"parcela"} /><I18nText text={row.count === 1 ? "" : "s"} /></span>
                  </div>
                  <div className="payable-abuse-track"><i style={{ width: `${Math.max(3, row.possibleExcess / maxExcess * 100)}%` }} /></div>
                  <strong>{row.percent.toFixed(1)}<I18nText text={"%"} /></strong>
                  <b>{formatCurrency(row.possibleExcess)}</b>
                </div>
              )) : <div className="empty-state"><I18nText text={"Nenhuma possível cobrança abusiva encontrada."} /></div>}
            </section>

            <section className="payable-abuse-list">
              <div className="panel-head">
                <div>
                  <h3 className="panel-title"><I18nText text={"Lista completa por credor"} /></h3>
                  <span className="panel-note"><I18nText text={"Ordenada por quem mais pode ter cobrado acima do critério."} /></span>
                </div>
              </div>
              <LocalDataList
                items={groups}
                itemLabel="credores"
                defaultPageSize={100}
                emptyMessage="Nenhum credor com possível cobrança abusiva."
                renderItems={(pageItems) => (
                  <div className="payable-abuse-creditor-list">
                    {pageItems.map((row) => (
                      <article key={row.key}>
                        <div>
                          <strong>{row.creditor}</strong>
                          <span>{row.document || <I18nText text={"Documento não informado"} />}</span>
                        </div>
                        <div><span><I18nText text={"Possível excesso"} /></span><strong>{formatCurrency(row.possibleExcess)}</strong></div>
                        <div><span><I18nText text={"% do total"} /></span><strong>{row.percent.toFixed(1)}<I18nText text={"%"} /></strong></div>
                        <div><span><I18nText text={"Parcelas"} /></span><strong>{row.count}</strong></div>
                        <div><span><I18nText text={"Pago acima do original"} /></span><strong>{formatCurrency(row.paidIncrease)}</strong></div>
                      </article>
                    ))}
                  </div>
                )}
              />
            </section>
          </div>
        </div>
      )}
    </>
  );
}
