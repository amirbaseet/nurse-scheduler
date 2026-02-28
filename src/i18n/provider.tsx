"use client";

import {
  createContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import heTranslations from "./he.json";
import arTranslations from "./ar.json";

export type Locale = "he" | "ar";

type Translations = Record<string, string>;

const translationMap: Record<Locale, Translations> = {
  he: heTranslations,
  ar: arTranslations,
};

export type I18nContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  dir: "rtl";
};

export const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("he");

  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale | null;
    if (saved === "he" || saved === "ar") {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("locale", newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  const t = useCallback(
    (key: string): string => {
      return translationMap[locale][key] ?? key;
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dir: "rtl" }}>
      {children}
    </I18nContext.Provider>
  );
}
