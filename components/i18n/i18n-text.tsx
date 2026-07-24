"use client";

import { useI18n } from "@/components/i18n/i18n-provider";

export function I18nText({ text }: { text: string }) {
  const { t } = useI18n();
  return t(text);
}
