'use client';

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
  user: any;
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
  return (
    <div className="support-panels-grid grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8 relative z-20 animate-slide-up">
      {/* CARD 1: CONTATO E SUPORTE */}
      <div className="support-panel-card app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 shadow-2xl relative group hover:border-blue-500/30 transition-all duration-500">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />

        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          🙋‍♀️ Central de Suporte & Atendimento
        </h3>
        <p className="text-sm text-gray-400 mb-6 leading-relaxed">
          Precisa de ajuda com o extrator, tem dúvidas sobre faturamento ou quer sugerir alguma melhoria no sistema? Nossa equipe está pronta para responder!
        </p>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <span className="text-[10px] text-gray-500 uppercase block font-bold tracking-wider">E-mail de Suporte</span>
              <span className="text-sm text-gray-200 font-medium font-mono break-all">pixel010dev@gmail.com</span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText('pixel010dev@gmail.com');
                showToast('E-mail copiado!', 'success');
              }}
              className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 cursor-pointer transition-colors"
            >
              📋 Copiar
            </button>
          </div>

          <a
            href="mailto:pixel010dev@gmail.com?subject=Suporte GeoLeads&body=Olá equipe GeoLeads,"
            className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
          >
            ✉️ Abrir Chamado por E-mail
          </a>

          <a
            href="https://mail.google.com/mail/?view=cm&fs=1&to=pixel010dev@gmail.com&su=Suporte%20GeoLeads&body=Ol%C3%A1%20equipe%20GeoLeads%2C"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 rounded-xl font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 text-sm"
          >
            🌐 Abrir no Gmail Web
          </a>
        </div>
      </div>

      {/* CARD 2: AVALIAÇÃO DE DESEMPENHO */}
      <div className="support-panel-card app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 shadow-2xl relative group hover:border-purple-500/30 transition-all duration-500">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />

        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          ⭐ Avalie a sua Experiência
        </h3>
        <p className="text-sm text-gray-400 mb-6 leading-relaxed">
          Sua opinião nos ajuda a evoluir a plataforma. Como tem sido sua experiência no GeoLeads?
        </p>

        {supportSubmitted ? (
          <div className="py-8 text-center text-green-400 animate-fade-in">
            <div className="text-5xl mb-3">🎉</div>
            <h4 className="font-bold text-lg text-gray-100">Muito obrigado pela avaliação!</h4>
            <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto leading-relaxed">Seu feedback foi registrado e será lido pela nossa equipe de desenvolvimento.</p>
            <button
              onClick={() => {
                setSupportSubmitted(false);
                setSupportRating(0);
                setSupportFeedback('');
              }}
              className="mt-6 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 cursor-pointer transition-colors"
            >
              Avaliar Novamente
            </button>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (supportRating === 0) {
                showToast('Selecione uma nota de 1 a 5 estrelas.', 'warning');
                return;
              }
              try {
                const res = await fetch('/api/feedback', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    rating: supportRating,
                    feedback: supportFeedback,
                    name: user?.email || 'Usuário',
                    userId: user?.id || null,
                  }),
                });
                if (!res.ok) throw new Error('Erro ao enviar');
                setSupportSubmitted(true);
                showToast('Avaliação enviada com sucesso!', 'success');
              } catch (err) {
                console.error('Feedback error:', err);
                showToast('Erro ao enviar avaliação. Tente novamente.', 'error');
              }
            }}
            className="space-y-5"
          >
            <div className="support-rating-box flex flex-col items-center justify-center p-4 bg-black/35 rounded-xl border border-white/5">
              <span className="text-xs text-gray-500 mb-2 font-medium">Sua nota de 1 a 5 estrelas:</span>
              <div className="support-rating-stars">
                {[1, 2, 3, 4, 5].map(star => {
                  const StarIsHighlighted = (hoveredStar !== null ? star <= hoveredStar : star <= supportRating);
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setSupportRating(star)}
                      onMouseEnter={() => setHoveredStar(star)}
                      onMouseLeave={() => setHoveredStar(null)}
                      className={`text-3xl focus:outline-none transition-all hover:scale-125 cursor-pointer duration-150 ${
                        StarIsHighlighted
                          ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.85)] scale-110'
                          : 'text-gray-600 hover:text-gray-400'
                      }`}
                    >
                      {StarIsHighlighted ? '★' : '☆'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Como podemos melhorar? (Opcional):</label>
              <textarea
                rows={3}
                placeholder="Deixe sua sugestão ou elogio..."
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all resize-none text-sm"
                value={supportFeedback}
                onChange={(e) => setSupportFeedback(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-200 cursor-pointer"
            >
              Enviar Avaliação
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
