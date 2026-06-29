'use client';

import type { AiCopyResult } from '@/types/crm';
import { useTranslations } from '@/lib/i18n';
import { Button } from '@/components/Button';
import { showToast, type ToastType } from '@/components/Toast';
import type { DashboardTab } from './dashboard-constants';

export interface AICopySectionProps {
  aiProduct: string;
  setAiProduct: (v: string) => void;
  aiValue: string;
  setAiValue: (v: string) => void;
  aiTone: string;
  setAiTone: (v: string) => void;
  generatedCopies: AiCopyResult[] | null;
  isGeneratingCopies: boolean;
  generateAICopies: (e: React.FormEvent) => Promise<void>;
  setWaTemplate: (v: string) => void;
  setActiveTab: (tab: DashboardTab) => void;
  showToast: (msg: string, type?: ToastType) => void;
}

export default function AICopySection({
  aiProduct,
  setAiProduct,
  aiValue,
  setAiValue,
  aiTone,
  setAiTone,
  generatedCopies,
  isGeneratingCopies,
  generateAICopies,
  setWaTemplate,
  setActiveTab,
  showToast,
}: AICopySectionProps) {
  const { t } = useTranslations();

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: t('aiCopy.overviewGenerated'), value: generatedCopies?.length || 0, color: 'text-purple-400' },
          { label: t('aiCopy.overviewTone'), value: aiTone === 'persuasive' ? t('aiCopy.tonePersuasive') : aiTone === 'direct' ? t('aiCopy.toneDirect') : t('aiCopy.toneCurious'), color: 'text-cyan-400' },
          { label: t('aiCopy.overviewStatus'), value: isGeneratingCopies ? t('aiCopy.generating') : 'Pronto', color: isGeneratingCopies ? 'text-amber-400' : 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="bg-black/30 border border-white/5 rounded-xl p-3 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8 relative z-20">
      {/* PAINEL DE ENTRADAS */}
      <div className="lg:col-span-1">
        <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />

          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            {t('aiCopy.title')}
          </h2>

          <form onSubmit={generateAICopies} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">{t('aiCopy.productLabel')}</label>
              <input
                type="text"
                placeholder={t('aiCopy.productPlaceholder')}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all"
                value={aiProduct}
                onChange={(e) => setAiProduct(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">{t('aiCopy.valueLabel')}</label>
              <textarea
                rows={3}
                placeholder={t('aiCopy.valuePlaceholder')}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all resize-none"
                value={aiValue}
                onChange={(e) => setAiValue(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">{t('aiCopy.toneLabel')}</label>
              <select
                value={aiTone}
                onChange={(e) => setAiTone(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="w-full bg-black/80 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-all cursor-pointer"
              >
                <option value="persuasive">{t('aiCopy.tonePersuasive')}</option>
                <option value="direct">{t('aiCopy.toneDirect')}</option>
                <option value="curious">{t('aiCopy.toneCurious')}</option>
              </select>
            </div>

            <Button
              type="submit"
              loading={isGeneratingCopies}
              size="lg"
              className="w-full hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
            >
              {isGeneratingCopies ? t('aiCopy.generating') : t('aiCopy.generate')}
            </Button>
          </form>
        </div>
      </div>

      {/* RESULTADO DAS COPYS */}
      <div className="lg:col-span-2">
        <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 h-full flex flex-col shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            {t('aiCopy.readyModels')}
            {generatedCopies && <span className="text-sm px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">{generatedCopies.length}</span>}
          </h2>

          {generatedCopies ? (
            <div className="space-y-5 pr-1 sm:pr-2 overflow-y-auto max-h-[500px]">
              {generatedCopies.map((copy, index) => (
                <div key={index} className="p-5 sm:p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-purple-500/30 transition-all">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h4 className="text-sm font-bold text-purple-400">{copy.title}</h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">{copy.desc}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold whitespace-nowrap">{t('aiCopy.modelName', { n: index + 1 })}</span>
                  </div>

                  <div className="text-xs bg-black/50 border border-white/5 rounded-xl p-4 font-sans text-gray-300 leading-relaxed whitespace-pre-wrap select-all">
                    {copy.text}
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={() => { setWaTemplate(copy.text); setActiveTab('whatsapp'); }}
                      variant="ghost" size="sm"
                      className="bg-green-500/10 hover:bg-green-500/20 text-green-300 border border-green-500/20"
                    >
                      {t('aiCopy.useInDispatcher')}
                    </Button>
                    <Button
                      onClick={() => { navigator.clipboard.writeText(copy.text); showToast('Copiado!', 'success'); }}
                      variant="ghost" size="sm"
                      className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20"
                    >
                      {t('aiCopy.copy')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-16 text-gray-500">
              <div className="text-5xl mb-4">🤖</div>
              <p className="font-semibold text-lg text-gray-300">{t('aiCopy.emptyTitle')}</p>
              <p className="text-sm max-w-sm mt-1 mx-auto text-gray-500">{t('aiCopy.emptyDesc')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
