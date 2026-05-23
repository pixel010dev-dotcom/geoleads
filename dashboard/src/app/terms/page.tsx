import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Termos de Uso — GeoLeads',
  description: 'Termos e condições de uso da plataforma GeoLeads.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen text-white font-sans selection:bg-blue-500/30 bg-black relative overflow-x-hidden">
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none opacity-30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(600px,92vw)] h-[200px] bg-blue-700/10 blur-[90px] rounded-full pointer-events-none" />

      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-2xl sticky top-0 z-50">
        <div className="app-container min-h-14 py-2 flex items-center justify-between gap-3">
          <Link href="/" className="font-extrabold text-lg tracking-tight text-white">Geo<span className="text-blue-400">Leads</span></Link>
          <Link href="/" className="text-xs text-gray-400 hover:text-white transition-colors">← Voltar</Link>
        </div>
      </nav>

      <main className="app-container py-10 sm:py-16 relative z-10 max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">Termos de Uso</h1>
        <p className="text-sm text-gray-500 mb-8">Última atualização: 23 de maio de 2026</p>

        <div className="space-y-6 text-sm sm:text-base text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-2">1. Aceitação dos Termos</h2>
            <p>Ao criar uma conta e utilizar a plataforma GeoLeads, o usuário declara ter lido, compreendido e aceito integralmente estes Termos de Uso. Caso não concorde com qualquer disposição, não deverá utilizar o serviço.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">2. Descrição do Serviço</h2>
            <p>O GeoLeads é uma plataforma SaaS que permite ao usuário extrair dados públicos de estabelecimentos no Google Maps (nome, telefone, e-mail, endereço, etc.), gerenciar estes contatos em um CRM integrado, enviar mensagens via WhatsApp, e gerar relatórios. Os dados extraídos são provenientes de fontes públicas e abertas.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">3. Elegibilidade</h2>
            <p>O usuário declara ser maior de 18 anos ou estar devidamente autorizado por seus responsáveis legais. O usuário garante que as informações fornecidas no cadastro são verdadeiras, precisas e completas.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">4. Responsabilidade do Usuário</h2>
            <p className="mb-2">O usuário é o único responsável por:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li><strong className="text-gray-200">Uso dos leads:</strong> a forma como os leads extraídos são contatados e tratados é de responsabilidade exclusiva do usuário. O GeoLeads não se responsabiliza por violações de privacidade, spam, assédio ou qualquer outro uso indevido.</li>
              <li><strong className="text-gray-200">Conformidade legal:</strong> o usuário deve cumprir todas as leis aplicáveis, incluindo a LGPD, Código de Defesa do Consumidor, Marco Civil da Internet e legislações setoriais relevantes.</li>
              <li><strong className="text-gray-200">Segurança da conta:</strong> manter a confidencialidade da senha e notificar imediatamente o GeoLeads sobre qualquer uso não autorizado.</li>
              <li><strong className="text-gray-200">Opt-out:</strong> todas as mensagens enviadas através da plataforma devem oferecer ao destinatário a possibilidade de descadastro ou solicitação de não recebimento de novas mensagens.</li>
              <li><strong className="text-gray-200">Conteúdo:</strong> não utilizar a plataforma para enviar mensagens abusivas, enganosas, difamatórias, ilegais ou que violem direitos de terceiros.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">5. Planos e Pagamentos</h2>
            <p className="mb-2">Os planos e preços estão detalhados na página de planos da plataforma:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>O pagamento é processado pelo Mercado Pago</li>
              <li>As renovações são automáticas ao final de cada ciclo</li>
              <li>O cancelamento pode ser solicitado a qualquer momento, sem multa</li>
              <li>O reembolso segue a política estabelecida na página de planos</li>
              <li>O não pagamento resulta na suspensão imediata do acesso</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">6. Propriedade Intelectual</h2>
            <p>A plataforma GeoLeads, incluindo seu código, design, logotipos, nome e conteúdo, é propriedade exclusiva da GeoLeads. O usuário não adquire nenhum direito de propriedade intelectual ao utilizar o serviço.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">7. Limitação de Responsabilidade</h2>
            <p>O GeoLeads não será responsável por danos indiretos, incidentais, especiais ou consequenciais decorrentes do uso ou da impossibilidade de uso da plataforma. A responsabilidade máxima do GeoLeads se limita ao valor pago pelo usuário nos 12 meses anteriores ao evento danoso.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">8. Disponibilidade</h2>
            <p>O GeoLeads se esforça para manter a plataforma disponível 24/7, mas não garante disponibilidade ininterrupta. Manutenções programadas serão comunicadas com antecedência quando possível. Períodos de indisponibilidade não geram direito a reembolso proporcional.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">9. Suspensão e Cancelamento</h2>
            <p>O GeoLeads pode suspender ou cancelar contas que violem estes Termos de Uso, incluindo mas não se limitando a: uso não autorizado do serviço, violação de leis, tentativas de burlar o sistema, abuso de recursos (rate limiting), ou inadimplemento. Em caso de cancelamento por violação, não haverá reembolso.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">10. Disposições Gerais</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li><strong className="text-gray-200">Alterações:</strong> estes termos podem ser alterados a qualquer momento, com comunicação aos usuários por e-mail ou notificação na plataforma. O uso continuado após a alteração constitui aceitação.</li>
              <li><strong className="text-gray-200">Foro:</strong> fica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer controvérsias decorrentes destes Termos.</li>
              <li><strong className="text-gray-200">Legislação:</strong> estes Termos são regidos pela legislação brasileira.</li>
              <li><strong className="text-gray-200">Integralidade:</strong> estes Termos constituem o acordo integral entre as partes, substituindo entendimentos anteriores.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">11. Contato</h2>
            <p>Para dúvidas ou comunicação sobre estes Termos:</p>
            <p className="mt-2 text-gray-400">E-mail: <a href="mailto:pixel010dev@gmail.com" className="text-blue-400 hover:underline">pixel010dev@gmail.com</a></p>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/5 mt-12 py-6 text-center text-xs text-gray-600">
        <p>© 2026 GeoLeads. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
