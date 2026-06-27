export const metadata = {
  title: 'Política de Privacidade - GeoLeads',
  description: 'Política de privacidade do GeoLeads - entenda como tratamos seus dados.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black text-gray-300 py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Política de Privacidade</h1>
        <p className="text-sm text-gray-500 mb-8">Última atualização: 27 de junho de 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">1. Coleta de Dados</h2>
          <p className="mb-3">O GeoLeads coleta os seguintes dados para funcionamento do serviço:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Nome, email e telefone do usuário (cadastro)</li>
            <li>Dados de leads extraídos do Google Maps (informações públicas)</li>
            <li>Histórico de extrações e uso do sistema</li>
            <li>Informações de pagamento (processadas pelo Mercado Pago, não armazenamos dados de cartão)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">2. Uso dos Dados</h2>
          <p>Os dados coletados são utilizados exclusivamente para:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Fornecer e melhorar o serviço de extração de leads</li>
            <li>Processar pagamentos e gerenciar planos</li>
            <li>Enviar comunicações relacionadas ao serviço</li>
            <li>Cumprir obrigações legais e regulatórias</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">3. Armazenamento e Segurança</h2>
          <p>Seus dados são armazenados em servidores seguros com criptografia. Utilizamos Supabase (PostgreSQL) com políticas de segurança RLS e conexões SSL/TLS.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">4. Compartilhamento de Dados</h2>
          <p>Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros, exceto quando necessário para:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Processamento de pagamentos (Mercado Pago)</li>
            <li>Cumprimento de obrigações legais</li>
            <li>Proteção contra fraudes e abusos</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">5. Seus Direitos</h2>
          <p>Você tem direito a acessar, corrigir ou excluir seus dados a qualquer momento. Para isso, entre em contato pelo email: contato@geoleads.com.br</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">6. Cookies</h2>
          <p>Utilizamos cookies essenciais para o funcionamento do sistema. Não utilizamos cookies de rastreamento ou publicidade sem seu consentimento explícito.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">7. Contato</h2>
          <p>Para questões sobre privacidade: <a href="mailto:contato@geoleads.com.br" className="text-blue-400 hover:underline">contato@geoleads.com.br</a></p>
        </section>
      </div>
    </main>
  );
}
