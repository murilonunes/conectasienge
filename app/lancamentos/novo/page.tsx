import { I18nText } from "@/components/i18n/i18n-text";
import { PageHeading } from "@/components/ui/page-heading";
import { BillEntryForm } from "@/components/forms/bill-entry-form";

export default function NovoLancamentoPage() {
  return (
    <>
      <PageHeading eyebrow="Contas a pagar" title="Novo lançamento" subtitle="Crie um título diretamente no Sienge após revisar os dados." />
      <section className="card data-notice">
        <strong><I18nText text={"Operação real no Sienge"} /></strong>
        <span><I18nText text={"Esta é uma exceção ao fluxo de consulta local: ao confirmar, o sistema envia um novo título para a API do Sienge. Use somente depois de revisar os dados."} /></span>
      </section>
      <BillEntryForm />
    </>
  );
}
