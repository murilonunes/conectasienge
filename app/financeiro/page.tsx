import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";

const mainShortcuts = [
  {
    title: "Dashboard financeiro",
    href: "/dashboard",
    note: "Resumo executivo com entradas, saídas, saldos e gráficos."
  },
  {
    title: "Contas a pagar",
    href: "/contas-pagar",
    note: "Agenda, busca avançada, parcelas abertas e baixas já registradas."
  },
  {
    title: "Contas a receber",
    href: "/contas-receber",
    note: "Previsão de recebimentos, parcelas em aberto e valores recebidos."
  },
  {
    title: "Conciliação",
    href: "/conciliacao",
    note: "Visão mensal dos movimentos conciliados, pendentes e avulsos."
  },
  {
    title: "Baixa de parcela",
    href: "/lancamentos/baixa",
    note: "Consulte título a pagar, parcelas, pagamentos e instruções vinculadas."
  },
  {
    title: "Baixa a receber",
    href: "/lancamentos/baixa-receber",
    note: "Consulte títulos a receber, parcelas e recebimentos já registrados."
  }
];

const flow = [
  {
    title: "Atualizar dados",
    text: "Use Configurações para buscar informações novas no Sienge e salvar para as telas."
  },
  {
    title: "Analisar a operação",
    text: "Abra Dashboard, contas, compras, vendas e estoque para entender o cenário atual."
  },
  {
    title: "Executar rotinas",
    text: "Faça consultas, conferências, baixas e conciliação nas telas específicas."
  }
];

export default function FinanceiroPage() {
  return (
    <>
      <PageHeading
        eyebrow="Central financeira"
        title="Operação financeira"
        subtitle="Acesse as rotinas financeiras do sistema sem carregar dados pesados nesta abertura."
        action="Atualizar dados"
        actionHref="/configuracoes"
      />

      <section className="card welcome-hero">
        <div>
          <span>Fluxo atual</span>
          <h2>Dados salvos primeiro, telas rápidas depois</h2>
          <p>
            Esta central serve como ponto de partida. As consultas ao Sienge ficam em Configurações;
            as telas operacionais leem os dados já integrados e mostram a data da última integração.
          </p>
        </div>
        <Link className="button" href="/dashboard">Ver visão geral</Link>
      </section>

      <section className="card settings-flow">
        {flow.map((item) => (
          <div key={item.title}>
            <strong>{item.title}</strong>
            <span>{item.text}</span>
          </div>
        ))}
      </section>

      <section className="welcome-shortcuts">
        {mainShortcuts.map((shortcut) => (
          <Link className="card welcome-shortcut" href={shortcut.href} key={shortcut.href}>
            <strong>{shortcut.title}</strong>
            <span>{shortcut.note}</span>
          </Link>
        ))}
      </section>
    </>
  );
}
