"use client";
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from '@/lib/i18n';

export default function DashboardPreview() {
  const { t } = useTranslations();
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`app-container py-12 sm:py-24 transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10 sm:mb-12">
          <span className="badge-blue mb-3">{t('dashboardPreview.title')}</span>
          <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight mt-3">{t('dashboardPreview.subtitle')}</h2>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-600/20 rounded-3xl blur-2xl" />

          <div className="relative rounded-2xl sm:rounded-3xl border border-white/10 bg-[#0a0a12] overflow-hidden shadow-2xl shadow-blue-600/10">
            <div className="flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5 bg-black/40">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <div className="ml-4 flex items-center gap-2 text-[11px] text-gray-500">
                <div className="w-4 h-4 rounded bg-gradient-to-br from-blue-500 to-indigo-600" />
                GeoLeads — Dashboard
              </div>
            </div>

            <div className="grid grid-cols-[180px_1fr] sm:grid-cols-[220px_1fr] min-h-[320px] sm:min-h-[400px]">
              <div className="border-r border-white/5 bg-black/30 p-3 sm:p-4 hidden sm:flex flex-col gap-3">
                {[t('dashboardPreview.tab1'), t('dashboardPreview.tab2'), t('dashboardPreview.tab3'), t('dashboardPreview.tab4'), t('dashboardPreview.tab5')].map((label) => (
                  <div key={label} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${label === t('dashboardPreview.tab1') ? 'bg-blue-600/20 text-blue-300 border border-blue-500/20' : 'text-gray-500 hover:text-gray-300'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${label === t('dashboardPreview.tab1') ? 'bg-blue-400' : 'bg-gray-600'}`} />
                    {label}
                  </div>
                ))}
              </div>

              <div className="p-3 sm:p-5 flex flex-col gap-3 sm:gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-white">{t('dashboardPreview.tab1')}</h3>
                  <div className="flex items-center gap-2 text-[10px] sm:text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      {t('dashboardPreview.online')}
                    </span>
                    <span className="hidden sm:inline">|</span>
                    <span className="hidden sm:inline">4.200+ leads</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                  {[
                    { label: t('dashboardPreview.leadsToday'), value: '47', color: 'from-blue-500 to-indigo-500' },
                    { label: t('dashboardPreview.tokens'), value: '2.340', color: 'from-emerald-500 to-teal-500' },
                    { label: t('dashboardPreview.sent'), value: '128', color: 'from-violet-500 to-purple-500' },
                    { label: t('dashboardPreview.conversions'), value: '12', color: 'from-amber-500 to-orange-500' },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl bg-white/[0.03] border border-white/5 p-3 sm:p-4">
                      <p className="text-[10px] sm:text-xs text-gray-500 mb-1">{stat.label}</p>
                      <p className={`text-lg sm:text-2xl font-extrabold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex-1 rounded-xl bg-white/[0.02] border border-white/5 p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] sm:text-xs font-bold text-gray-400">{t('dashboardPreview.latestExtractions')}</span>
                    <span className="text-[10px] sm:text-xs text-blue-400">{t('dashboardPreview.viewAll')}</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { name: 'Academias SP', qty: '47 leads', time: '2 min atrás' },
                      { name: 'Restaurantes RJ', qty: '32 leads', time: '15 min atrás' },
                      { name: 'Clínicas BH', qty: '28 leads', time: '1h atrás' },
                      { name: 'Petshops Curitiba', qty: '19 leads', time: '3h atrás' },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60" />
                          <span className="text-xs sm:text-sm text-gray-300">{row.name}</span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className="text-[10px] sm:text-xs text-emerald-400 font-bold">{row.qty}</span>
                          <span className="text-[10px] sm:text-xs text-gray-600">{row.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
