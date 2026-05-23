import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidade — GeoLeads',
  description: 'Política de privacidade e tratamento de dados do GeoLeads.',
};

export default function PrivacyPage() {
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
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">Política de Privacidade</h1>
        <p className="text-sm text-gray-500 mb-8">Última atualização: 23 de maio de 2026</p>

        <div className="space-y-6 text-sm sm:text-base text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-2">1. Introdução</h2>
            <p>O GeoLeads respeita a sua privacidade e está comprometido com a proteção dos dados pessoais dos seus usuários. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos as informações dos usuários da plataforma, em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018).</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">2. Dados Coletados</h2>
            <p className="mb-2">Coletamos os seguintes dados pessoais dos usuários:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li><strong className="text-gray-200">Dados de cadastro:</strong> nome, endereço de e-mail e senha (criptografada) fornecidos no momento da criação da conta.</li>
              <li><strong className="text-gray-200">Dados de pagamento:</strong> processados exclusivamente pelo Mercado Pago. O GeoLeads não armazena números de cartão de crédito ou dados bancários.</li>
              <li><strong className="text-gray-200">Dados de uso:</strong> nichos pesquisados, leads extraídos, estágios do CRM, mensagens enviadas via WhatsApp, preferências do chatbot.</li>
              <li><strong className="text-gray-200">Leads:</strong> informações de terceiros (nome, telefone, e-mail, CNPJ, redes sociais) extraídas de fontes públicas como Google Maps. O usuário é o controlador destes dados.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">3. Finalidade do Tratamento</h2>
            <p className="mb-2">Os dados coletados são utilizados para:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>Operar a plataforma de extração e gestão de leads</li>
              <li>Autenticar o usuário e gerenciar sua conta</li>
              <li>Processar pagamentos e gerenciar planos</li>
              <li>Oferecer suporte técnico e atendimento</li>
              <li>Enviar comunicações relacionadas ao serviço (notificações de extração, alertas de tokens)</li>
              <li>Melhorar a plataforma com base em dados de uso agregados</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">4. Compartilhamento de Dados</h2>
            <p>O GeoLeads não vende, aluga ou compartilha dados pessoais com terceiros para fins de marketing. Podemos compartilhar dados nas seguintes situações:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-400 mt-2">
              <li><strong className="text-gray-200">Provedores de infraestrutura:</strong> Supabase (banco de dados), Railway (hospedagem), Mercado Pago (pagamentos)</li>
              <li><strong className="text-gray-200">Determinação judicial:</strong> quando exigido por lei ou ordem judicial</li>
              <li><strong className="text-gray-200">Com consentimento:</strong> mediante autorização expressa do usuário</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">5. Armazenamento e Segurança</h2>
            <p>Os dados são armazenados em servidores seguros com criptografia em trânsito (TLS) e em repouso. Utilizamos:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-400 mt-2">
              <li>Criptografia de senhas com bcrypt/hash via Supabase Auth</li>
              <li>Políticas de segurança a nível de linha (RLS) no banco de dados</li>
              <li>Autenticação por token JWT com expiração</li>
              <li>Rate limiting para prevenir abusos</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">6. Direitos do Usuário (LGPD)</h2>
            <p className="mb-2">Nos termos da LGPD, você tem direito a:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>Confirmar a existência de tratamento de dados</li>
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados</li>
              <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários</li>
              <li>Revogar o consentimento a qualquer momento</li>
              <li>Solicitar a portabilidade dos dados a outro fornecedor</li>
              <li>Eliminar os dados tratados com consentimento</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">7. Exclusão de Dados</h2>
            <p>Você pode solicitar a exclusão dos seus dados a qualquer momento enviando um e-mail para <a href="mailto:pixel010dev@gmail.com?subject=Exclus%C3%A3o%20de%20Dados%20-%20GeoLeads" className="text-blue-400 hover:underline">pixel010dev@gmail.com</a> com o assunto "Exclusão de Dados — GeoLeads". Processaremos sua solicitação em até 15 dias úteis.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">8. Cookies</h2>
            <p>Utilizamos cookies essenciais para o funcionamento da plataforma (autenticação e sessão). Não utilizamos cookies de rastreamento ou publicidade. O usuário pode configurar seu navegador para rejeitar cookies, mas isso pode afetar o funcionamento de algumas funcionalidades.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">9. Responsabilidade sobre Leads</h2>
            <p>O GeoLeads é uma ferramenta de extração de dados públicos do Google Maps. O usuário é o único responsável pelo uso que faz dos leads extraídos, incluindo mas não se limitando a: envio de mensagens, abordagem comercial, conformidade com a LGPD ao contactar terceiros, e proibição de spam. Recomendamos que o usuário inclua mecanismo de opt-out em suas comunicações.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">10. Contato</h2>
            <p>Para exercer seus direitos ou esclarecer dúvidas sobre esta política, entre em contato:</p>
            <p className="mt-2 text-gray-400">E-mail: <a href="mailto:pixel010dev@gmail.com" className="text-blue-400 hover:underline">pixel010dev@gmail.com</a></p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">11. Alterações</h2>
            <p>Esta política pode ser atualizada periodicamente. Recomendamos a revisão regular. O uso continuado da plataforma após alterações constitui aceitação dos novos termos.</p>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/5 mt-12 py-6 text-center text-xs text-gray-600">
        <p>© 2026 GeoLeads. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
