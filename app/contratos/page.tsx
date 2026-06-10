import { PageHeading } from "@/components/ui/page-heading";
import { FilterBar } from "@/components/forms/filter-bar";
export default function ContratosPage() {
  return <><PageHeading eyebrow="Operações" title="Contratos" subtitle="Gestão de contratos e medições vinculadas." action="Novo contrato" /><FilterBar search="Buscar contrato ou fornecedor" /><div className="card empty-state"><h2>Contratos organizados em um só lugar</h2><p>Conecte os contratos do Sienge para acompanhar saldos, medições e reajustes.</p></div></>;
}
