import { PageHeading } from "@/components/ui/page-heading";
import { InstallmentSettlement } from "@/components/forms/installment-settlement";
import { AdvancedPayablesSearch } from "@/components/forms/advanced-payables-search";

export default function BaixaPage() {
  return <><PageHeading eyebrow="Contas a pagar" title="Pagamento e baixa" subtitle="Busque baixas por período e filtros avançados ou consulte diretamente um título." /><AdvancedPayablesSearch /><div className="section-divider"><span>ou consulte pelo código do título</span></div><InstallmentSettlement /></>;
}
