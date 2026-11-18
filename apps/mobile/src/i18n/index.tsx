import { getLocales } from "expo-localization";
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DevSettings, I18nManager } from "react-native";

import { ar } from "./ar";
import { en, type MessageKey } from "./en";

export type Lang = "en" | "ar";
export type { MessageKey };

const LANG_KEY = "khisha.lang";
const ATTEMPT_KEY = "khisha.rtlAttempt"; // stops a reload loop if the direction change does not take effect

I18nManager.allowRTL(true);

const MONTHS: Record<Lang, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
};

type Params = Record<string, string | number>;

type I18nState = {
  lang: Lang;
  isRTL: boolean;
  t: (key: MessageKey, params?: Params) => string;
  /** Numbers always use Western digits (0-9), in English and Arabic. */
  formatNumber: (n: number | string) => string;
  /** "2026-11-12" or an ISO timestamp -> "12 Nov 2026" / "12 نوفمبر 2026" (Western digits). */
  formatDate: (iso: string) => string;
  setLanguage: (next: Lang) => Promise<void>;
};

const I18nContext = createContext<I18nState | null>(null);

function deviceLanguage(): Lang {
  try {
    return getLocales()[0]?.languageCode === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}

/**
 * Makes the layout direction match the language. React Native only applies a direction change after a restart,
 * so this triggers one. Returns true when a restart was requested.
 */
async function ensureDirection(lang: Lang): Promise<boolean> {
  const wantRtl = lang === "ar";
  if (I18nManager.isRTL === wantRtl) {
    await SecureStore.deleteItemAsync(ATTEMPT_KEY);
    return false;
  }
  if ((await SecureStore.getItemAsync(ATTEMPT_KEY)) === lang) return false;
  await SecureStore.setItemAsync(ATTEMPT_KEY, lang);
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(wantRtl);
  DevSettings.reload();
  return true;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      let saved: string | null = null;
      try {
        saved = await SecureStore.getItemAsync(LANG_KEY);
      } catch {
        saved = null;
      }
      const initial: Lang = saved === "ar" || saved === "en" ? saved : deviceLanguage();
      if (!active) return;
      setLang(initial);
      await ensureDirection(initial);
    })();
    return () => {
      active = false;
    };
  }, []);

  const setLanguage = useCallback(async (next: Lang) => {
    await SecureStore.setItemAsync(LANG_KEY, next);
    setLang(next);
    await ensureDirection(next);
  }, []);

  const value = useMemo<I18nState | null>(() => {
    if (!lang) return null;
    const dict: Record<MessageKey, string> = lang === "ar" ? ar : en;
    const t = (key: MessageKey, params?: Params) => {
      let s: string = dict[key] ?? en[key];
      if (params) for (const k of Object.keys(params)) s = s.split(`{${k}}`).join(String(params[k]));
      return s;
    };
    const formatNumber = (n: number | string) => String(n);
    const formatDate = (iso: string) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
      if (!m) return iso;
      const month = MONTHS[lang][Number(m[2]) - 1];
      return month ? `${Number(m[3])} ${month} ${m[1]}` : iso;
    };
    return { lang, isRTL: lang === "ar", t, formatNumber, formatDate, setLanguage };
  }, [lang, setLanguage]);

  if (!value) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
