'use client';

import { showToast } from '@/components/Toast';

export interface AICopySectionProps {
  aiProduct: string;
  setAiProduct: (v: string) => void;
  aiValue: string;
  setAiValue: (v: string) => void;
  aiTone: string;
  setAiTone: (v: string) => void;
  generatedCopies: any[] | null;
  isGeneratingCopies: boolean;
  generateAICopies: (e: React.FormEvent) => Promise<void>;
  setWaTemplate: (v: string) => void;
  setActiveTab: (tab: string) => void;
  showToast: (msg: string, type?: string) => void;
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
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8 relative z-20 animate-slide-up">
      {/* PAINEL DE ENTRADAS */}
      <div className="lg:col-span-1">
        <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />

          <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
            🤖 Gerador de Copys IA
          </h3>

          <form onSubmit={generateAICopies} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">O que a sua empresa vende?</label>
              <input
                type="text"
                placeholder="ex: Gestão de Tráfego Pago, Software ERP..."
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                value={aiProduct}
                onChange={(e) => setAiProduct(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Qual o maior ganho/proposta de valor?</label>
              <textarea
                rows={3}
                placeholder="ex: Colocar mais clientes na porta todos os dias e aumentar o faturamento em 30%"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all resize-none"
                value={aiValue}
                onChange={(e) => setAiValue(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Tom de Voz</label>
              <select
                value={aiTone}
                onChange={(e) => setAiTone(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="w-full bg-black/80 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all cursor-pointer"
              >
                <option value="persuasive">Persuasivo & Marcante</option>
                <option value="direct">Curto & Direto ao Ponto</option>
                <option value="curious">Curioso & Provocativo</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-200 cursor-pointer"
            >
              ✨ Gerar Roteiros de Alta Conversão
            </button>
          </form>
        </div>
      </div>

      {/* RESULTADO DAS COPYS */}
      <div className="lg:col-span-2">
        <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 h-full flex flex-col shadow-2xl">
          <h3 className="text-xl font-semibold mb-6">Modelos Prontos para Uso</h3>

          {generatedCopies ? (
            <div className="app-copy-block space-y-5 pr-1 sm:pr-2">
              {generatedCopies.map((copy, index) => (
                <div key={index} className="p-4 sm:p-6 rounded-2xl bg-white/[0.02] border border-white/5 relative group hover:border-purple-500/30 transition-all">
                  <h4 className="text-sm font-bold text-purple-400 mb-1">{copy.title}</h4>
                  <p className="text-[11px] text-gray-500 mb-4">{copy.desc}</p>

                  <pre className="text-xs bg-black/50 border border-white/5 rounded-xl p-3 sm:p-4 font-sans text-gray-300 leading-relaxed whitespace-pre-wrap select-all">
                    {copy.text}
                  </pre>

                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => {
                        setWaTemplate(copy.text);
                        setActiveTab('whatsapp');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-300 border border-green-500/20 text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                    >
                      Usar no Disparador
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(copy.text);
                        showToast('Copiado!', 'success');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                    >
                      📋 Copiar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-16 text-gray-500">
              <div className="text-5xl mb-4">🤖</div>
              <p className="font-semibold text-lg text-gray-300">Crie copys personalizadas sem esforço</p>
              <p className="text-sm max-w-sm mt-1 mx-auto text-gray-500">Insira as informações da sua oferta no painel ao lado e a IA criará roteiros comerciais prontos, otimizados para prospecção fria.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
