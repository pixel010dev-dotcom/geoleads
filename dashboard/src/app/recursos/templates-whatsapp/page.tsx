import LeadMagnetGate from '@/components/LeadMagnetGate';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Templates de WhatsApp que Convertem | WhatsAI',
  description: 'Baixe grátis templates de mensagens WhatsApp prontos pra prospectar clientes automaticamente. Restaurantes, salões, advocacia e mais.',
  robots: { index: false, follow: false },
};

export default function TemplatesWhatsAppPage() {
  return (
    <LeadMagnetGate
      product="whatsai"
      title="50 Templates de WhatsApp que Convertem"
      subtitle="Mensagens prontas pra cada nicho — é só copiar e colar"
      description="Templates testados que geraram resposta real em restaurantes, salões, advocacia, mercados e mais."
      benefits={[
        '10 templates pra restaurantes e pizzarias',
        '8 templates pra salões e barbearias',
        '7 templates pra advocacia e escritórios',
        'Como lidar com objeções (respostas prontas)',
        'Call to Action que realmente vendem',
      ]}
      fileName="templates-whatsapp.txt"
    />
  );
}
