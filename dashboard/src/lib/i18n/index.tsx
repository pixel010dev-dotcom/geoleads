'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type Locale = 'pt-BR' | 'en';
const locales: Locale[] = ['pt-BR', 'en'];

const translations: Record<Locale, Record<string, any>> = {
  'pt-BR': {} as Record<string, any>,
  'en': {} as Record<string, any>,
};

let loaded = false;
async function loadTranslations() {
  if (loaded) return;
  translations['pt-BR'] = (await import('./translations/pt-BR.json')).default;
  translations['en'] = (await import('./translations/en.json')).default;
  loaded = true;
}

type I18nContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locales: Locale[];
};

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('pt-BR');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadTranslations().then(() => {
      const saved = localStorage.getItem('geoleads_locale') as Locale | null;
      if (saved && locales.includes(saved)) {
        setLocaleState(saved);
      }
      setReady(true);
    });
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try { localStorage.setItem('geoleads_locale', newLocale); } catch {}
  }, []);

  const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = translations[locale];
    for (const k of keys) {
      value = value?.[k];
    }
    if (typeof value !== 'string') {
      let fallback: any = translations['pt-BR'];
      for (const k of keys) {
        fallback = fallback?.[k];
      }
      value = typeof fallback === 'string' ? fallback : key;
    }
    if (vars) {
      value = value.replace(/\{(\w+)\}/g, (_: string, name: string) => String(vars[name] ?? `{${name}}`));
    }
    return value;
  }, [locale]);

  if (!ready) {
    return <div className="fixed inset-0 bg-black z-[999]" />;
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, locales }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslations() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslations must be used within I18nProvider');
  return ctx;
}

export function getLocaleFromPath(path: string): Locale {
  if (path.startsWith('/en')) return 'en';
  return 'pt-BR';
}

export { locales };
