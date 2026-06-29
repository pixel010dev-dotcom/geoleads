'use client';

import { useTranslations } from '@/lib/i18n';
import { Button } from '@/components/Button';
import { showToast, type ToastType } from '@/components/Toast';

export interface SupportSectionProps {
  supportRating: number;
  setSupportRating: (v: number) => void;
  supportFeedback: string;
  setSupportFeedback: (v: string) => void;
  supportSubmitted: boolean;
  setSupportSubmitted: (v: boolean) => void;
  hoveredStar: number | null;
  setHoveredStar: (v: number | null) => void;
  user: { id: string; email?: string } | null;
  showToast: (msg: string, type?: ToastType) => void;
}

export default function SupportSection({
  supportRating,
  setSupportRating,
  supportFeedback,
  setSupportFeedback,
  supportSubmitted,
  setSupportSubmitted,
  hoveredStar,
  setHoveredStar,
  user,
  showToast,
}: SupportSectionProps) {
  const { t } = useTranslations();

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Status', value: supportSubmitted ? t('support.overviewRating') : t('support.overviewPending'), color: supportSubmitted ? 'text-green-400' : 'text-amber-400' },
          { label: t('support.overviewYourRating'), value: supportRating > 0 ? `${supportRating}/5` : '—', color: 'text-amber-400' },
          { label: t('support.overviewEmail'), value: t('support.overviewActive'), color: 'text-blue-400' },
          { label: t('support.overviewResponseTime'), value: t('support.overviewResponseValue'), color: 'text-gray-400' },
        ].map(s => (
          <div key={s.label} className="bg-black/30 border border-white/5 rounded-xl p-3 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8 relative z-20">
      {/* CARD 1: CONTATO E SUPORTE */}
      <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-400" />

        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          {t('support.title')}
        </h2>
        <p className="text-sm text-gray-400 mb-6 leading-relaxed">
          {t('support.subtitle')}
        </p>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-black/30 border border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <span className="text-[10px] text-gray-500 uppercase block font-bold tracking-wider">{t('support.email')}</span>
              <span className="text-sm text-gray-200 font-medium font-mono break-all">pixel010dev@gmail.com</span>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText('pixel010dev@gmail.com'); showToast('E-mail copiado!', 'success'); }}
              className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 cursor-pointer transition-colors"
            >
              {t('support.copy')}
            </button>
          </div>

          <Button href="mailto:pixel010dev@gmail.com?subject=Suporte GeoLeads&body=Olá equipe GeoLeads,"
            size="lg" className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-none">
            {t('support.openTicket')}
          </Button>

          <Button href="https://mail.google.com/mail/?view=cm&fs=1&to=pixel010dev@gmail.com&su=Suporte%20GeoLeads&body=Ol%C3%A1%20equipe%20GeoLeads%2C"
            target="_blank" rel="noopener noreferrer" variant="secondary" size="md" className="w-full">
            {t('support.openGmail')}
          </Button>
        </div>
      </div>

      {/* CARD 2: AVALIAÇÃO */}
      <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />

        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          {t('support.rateTitle')}
        </h2>
        <p className="text-sm text-gray-400 mb-6 leading-relaxed">
          {t('support.rateSubtitle')}
        </p>

        {supportSubmitted ? (
          <div className="py-8 text-center text-green-400 animate-fade-in">
            <div className="text-5xl mb-3">🎉</div>
            <h4 className="font-bold text-lg text-gray-100">{t('support.thanks')}</h4>
            <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">{t('support.thanksDesc')}</p>
            <button onClick={() => { setSupportSubmitted(false); setSupportRating(0); setSupportFeedback(''); }}
              className="mt-6 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 cursor-pointer transition-colors">
              {t('support.rateAgain')}
            </button>
          </div>
        ) : (
          <form onSubmit={async (e) => {
              e.preventDefault();
              if (supportRating === 0) { showToast('Selecione uma nota.', 'warning'); return; }
              try {
                const res = await fetch('/api/feedback', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ rating: supportRating, feedback: supportFeedback, name: user?.email || 'Usuário', userId: user?.id || null }),
                });
                if (!res.ok) throw new Error('Erro ao enviar');
                setSupportSubmitted(true);
                showToast('Avaliação enviada!', 'success');
              } catch { showToast('Erro ao enviar avaliação.', 'error'); }
            }}
            className="space-y-5"
          >
            <div className="flex flex-col items-center justify-center p-4 bg-black/35 rounded-xl border border-white/5">
              <span className="text-xs text-gray-500 mb-2 font-medium">Nota:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => {
                  const highlighted = (hoveredStar !== null ? star <= hoveredStar : star <= supportRating);
                  return (
                    <button key={star} type="button"
                      onClick={() => setSupportRating(star)}
                      onMouseEnter={() => setHoveredStar(star)}
                      onMouseLeave={() => setHoveredStar(null)}
                      className={`text-3xl focus:outline-none transition-all hover:scale-125 cursor-pointer duration-150 ${
                        highlighted ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.85)] scale-110' : 'text-gray-600 hover:text-gray-400'
                      }`}>
                      {highlighted ? '★' : '☆'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">{t('support.feedbackPlaceholder')}</label>
              <textarea rows={3} placeholder={t('support.feedbackHint')}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all resize-none text-sm"
                value={supportFeedback} onChange={(e) => setSupportFeedback(e.target.value)} />
            </div>

            <Button type="submit" size="lg" className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-none">
              {t('support.sendRating')}
            </Button>
          </form>
        )}
      </div>
    </div>
    </div>
  );
}
