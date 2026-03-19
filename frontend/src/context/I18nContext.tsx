import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { enUS, zhCN } from "date-fns/locale";
import { translations, type TranslationParams, type TranslationValue } from "../i18n";

export type Language = "en" | "zh-CN";

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, params?: TranslationParams) => string;
  isChinese: boolean;
  dateLocale: typeof enUS;
  excalidrawLangCode: string;
};

const LANGUAGE_STORAGE_KEY = "excalidash-language";

const format = (
  value: TranslationValue,
  params?: TranslationParams,
): string => {
  if (typeof value === "function") {
    return value(params);
  }
  if (!params) {
    return value;
  }
  return value.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
};

const detectLanguage = (): Language => {
  if (typeof window === "undefined") {
    return "en";
  }
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === "zh-CN" || stored === "en") {
    return stored;
  }
  const preferred = navigator.language.toLowerCase();
  return preferred.startsWith("zh") ? "zh-CN" : "en";
};

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(detectLanguage);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const value = useMemo<I18nContextValue>(() => {
    const dictionary = translations[language] as Record<string, TranslationValue>;
    const fallback = translations.en as Record<string, TranslationValue>;
    const t = (key: string, params?: TranslationParams) =>
      format(dictionary[key] ?? fallback[key] ?? key, params);

    return {
      language,
      setLanguage: setLanguageState,
      toggleLanguage: () => setLanguageState((current) => (current === "zh-CN" ? "en" : "zh-CN")),
      t,
      isChinese: language === "zh-CN",
      dateLocale: language === "zh-CN" ? zhCN : enUS,
      excalidrawLangCode: language === "zh-CN" ? "zh-CN" : "en-US",
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
};
