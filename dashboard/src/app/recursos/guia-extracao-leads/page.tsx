import LeadMagnetGate from '@/components/LeadMagnetGate';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Guia Completo de Extração de Leads | GeoLeads',
  description: 'Baixe grátis o guia completo de como extrair leads do Google Maps. Aprenda nichos, técnicas e templates que funcionam.',
  robots: { index: true, follow: true },
};

export default function GuiaExtracaoPage() {
  return (
    <LeadMagnetGate
      product="geoleads"
      title="Guia Completo: Como Extrair Leads do Google Maps"
      subtitle="Aprenda as técnicas que usamos pra extrair 10.000+ leads por mês"
      description="Material completo com nichos lucrativos, como evitar bloqueio e templates prontos."
      benefits={[
        '5 nichos mais lucrativos pra começar hoje',
        'Como evitar bloqueio no WhatsApp (passo a passo)',
        'Templates de mensagens que convertem em vendas',
        'Checklist de instalação do GeoLeads',
        'Planilha de exemplo com 100 leads reais',
      ]}
      fileName="guia-extracao-leads.txt"
    />
  );
}
