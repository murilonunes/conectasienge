"use client";

import { Languages } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import type { AppLocale } from "@/lib/i18n/config";

const options: Array<{ value: AppLocale; short: string; label: string }> = [
  { value: "pt-BR", short: "PT", label: "Português" },
  { value: "en-US", short: "EN", label: "English" }
];

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className={`language-switcher${compact ? " compact" : ""}`}>
      <Languages aria-hidden="true" size={15} strokeWidth={2} />
      <span className="language-switcher-label">{t("Idioma")}</span>
      <select
        aria-label={t("Idioma")}
        value={locale}
        onChange={(event) => setLocale(event.target.value as AppLocale)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {compact ? option.short : option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
