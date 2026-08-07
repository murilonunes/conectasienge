import { TitlesExplorer } from "@/components/titles/titles-explorer";
import { PageHeading } from "@/components/ui/page-heading";
import { loadFinancialTitles, titleFiltersFromParams } from "@/features/titles/data";

export const dynamic = "force-dynamic";

export default function TitlesPage({ searchParams = {} }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const result = loadFinancialTitles(titleFiltersFromParams(searchParams));

  return (
    <>
      <PageHeading
        eyebrow="Financeiro"
        title="Títulos"
        subtitle="Consulte contas a pagar e receber, inclusive pelo conteúdo da observação do título."
      />
      <TitlesExplorer result={result} />
    </>
  );
}
