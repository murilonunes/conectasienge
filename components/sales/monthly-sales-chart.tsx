import { I18nText } from "@/components/i18n/i18n-text";
import { formatCompactCurrency } from "@/lib/formatters";

type MonthlySalesItem = {
  label: string;
  value: number;
  exchangeValue: number;
  count: number;
};

export function MonthlySalesChart({ data }: { data: MonthlySalesItem[] }) {
  const maxGross = Math.max(...data.map((item) => item.value + item.exchangeValue), 1);
  const maxCount = Math.max(...data.map((item) => item.count), 1);

  return (
    <section className="card panel sales-monthly-panel">
      <div className="panel-head">
        <div><h2 className="panel-title"><I18nText text={"Vendas por mês"} /></h2><span className="panel-note"><I18nText text={"Valor vendido separado em caixa (à vista/prazo/financiamento) e permuta (bem recebido, sem caixa), com quantidade de contratos emitidos"} /></span></div>
        <div className="chart-legend"><span><i className="dot" /><I18nText text={"Caixa"} /></span><span><i className="dot exchange" /><I18nText text={"Permuta"} /></span><span><i className="dot out" /><I18nText text={"Contratos"} /></span></div>
      </div>
      {data.length ? <div className="sales-monthly-chart">
        {data.map((item) => {
          const gross = item.value + item.exchangeValue;
          return (
            <div className="sales-monthly-column" key={item.label} title={`${item.label}: ${formatCompactCurrency(item.value)} em caixa + ${formatCompactCurrency(item.exchangeValue)} em permuta = ${formatCompactCurrency(gross)} em ${item.count} contratos`}>
              <span><I18nText text={formatCompactCurrency(gross)} /></span>
              <div className="sales-monthly-bars">
                <div className="sales-value-stack" style={{ height: `${gross > 0 ? Math.max(4, (gross / maxGross) * 100) : 0}%` }}>
                  <i className="sales-cash-bar" style={{ flexGrow: Math.max(item.value, 0) || (item.exchangeValue > 0 ? 0 : 1) }} />
                  {item.exchangeValue > 0 && <i className="sales-exchange-bar" style={{ flexGrow: item.exchangeValue }} />}
                </div>
                <i className="sales-count-bar" style={{ height: `${item.count > 0 ? Math.max(4, (item.count / maxCount) * 100) : 0}%` }}><b>{item.count}</b></i>
              </div>
              <strong><I18nText text={item.label} /></strong>
            </div>
          );
        })}
      </div> : <div className="chart-empty"><I18nText text={"Nenhum contrato com data de emissão foi encontrado."} /></div>}
    </section>
  );
}
