"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  localeCookieName,
  localeLanguage,
  type AppLocale
} from "@/lib/i18n/config";
import { translateUiText } from "@/lib/i18n/messages";

type I18nContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (text: string) => string;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (value: number) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children, initialLocale }: { children: React.ReactNode; initialLocale: AppLocale }) {
  const router = useRouter();
  const [locale, setLocaleState] = useState(initialLocale);

  useEffect(() => {
    document.documentElement.lang = localeLanguage(locale);
  }, [locale]);

  useEffect(() => {
    const attributes = ["placeholder", "title", "aria-label", "alt"] as const;

    function translateElement(element: Element) {
      for (const attribute of attributes) {
        const source = element.getAttribute(`data-i18n-${attribute}`);
        if (source === null) continue;
        const translated = translateUiText(source, locale);
        if (element.getAttribute(attribute) !== translated) {
          element.setAttribute(attribute, translated);
        }
      }
    }

    function translateTree(root: ParentNode) {
      if (root instanceof Element) translateElement(root);
      root.querySelectorAll("[data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label], [data-i18n-alt]")
        .forEach(translateElement);
    }

    translateTree(document);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          translateElement(mutation.target as Element);
          continue;
        }
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) translateTree(node);
        });
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [...attributes]
    });
    return () => observer.disconnect();
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => {
    function setLocale(nextLocale: AppLocale) {
      setLocaleState(nextLocale);
      document.cookie = `${localeCookieName}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
      void fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale })
      }).finally(() => router.refresh());
    }

    return {
      locale,
      setLocale,
      t: (text) => translateUiText(text, locale),
      formatDate: (input, options) => new Intl.DateTimeFormat(locale, options).format(new Date(input)),
      formatNumber: (input, options) => new Intl.NumberFormat(locale, options).format(input),
      formatCurrency: (input) => new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "BRL"
      }).format(input)
    };
  }, [locale, router]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
