'use client';

import { useTranslations } from '@/lib/i18n';

export default function LanguageSwitcher() {
  const { locale, setLocale, locales } = useTranslations();

  return (
    <div className="flex items-center gap-1">
      {locales.map((l) => {
        const label = l === 'pt-BR' ? 'PT' : 'EN';
        const isActive = locale === l;
        return (
          <button
            key={l}
            onClick={() => setLocale(l)}
            className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
              isActive
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
