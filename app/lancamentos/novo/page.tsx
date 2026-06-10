import { PageHeading } from "@/components/ui/page-heading";
import { BillEntryForm } from "@/components/forms/bill-entry-form";

export default function NovoLancamentoPage() {
  return <><PageHeading eyebrow="Contas a pagar" title="Novo lançamento" subtitle="Crie um título diretamente no Sienge após revisar os dados." /><BillEntryForm /></>;
}
