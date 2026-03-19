import { en } from "./en";
import { zhCN } from "./zh-CN";
import type { TranslationDictionary } from "./types";

export const translations: Record<"en" | "zh-CN", TranslationDictionary> = {
  en,
  "zh-CN": zhCN,
};

export type { TranslationDictionary, TranslationParams, TranslationValue } from "./types";
