import { PageHeading } from "@/components/ui/page-heading";
import { InstallmentSettlement } from "@/components/forms/installment-settlement";
import { AdvancedPayablesSearch } from "@/components/forms/advanced-payables-search";

export default function BaixaPage() {
  return <><PageHeading eyebrow="Contas a pagar" title="Consulta de pagamentos e baixas" subtitle="Confira parcelas, baixas já registradas e possíveis cobranças abusivas usando os dados salvos localmente." /><AdvancedPayablesSearch /><div className="section-divider"><span>ou consulte pelo código do título</span></div><InstallmentSettlement /></>;
}
