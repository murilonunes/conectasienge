export const supportedLocales = ["pt-BR", "en-US"] as const;

export type AppLocale = (typeof supportedLocales)[number];

export const defaultLocale: AppLocale = "pt-BR";
export const localeCookieName = "brasin_locale";

export function resolveLocale(value?: string | null): AppLocale {
  if (!value) return defaultLocale;
  const normalized = value.toLowerCase();
  return normalized.startsWith("en") ? "en-US" : "pt-BR";
}
export function localeLanguage(locale: AppLocale) {
  return locale === "en-US" ? "en" : "pt-BR";
}
