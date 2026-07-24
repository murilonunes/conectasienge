"use client";

import { useI18n } from "@/components/i18n/i18n-provider";

export function PrintButton({ label = "Imprimir / salvar PDF" }: { label?: string }) {
  const { t } = useI18n();
  return (
    <button className="button" type="button" onClick={() => window.print()}>
      {t(label)}
    </button>
  );
}
