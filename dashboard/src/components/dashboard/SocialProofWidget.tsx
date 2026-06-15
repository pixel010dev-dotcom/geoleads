'use client';

import { socialProofMsgs } from './dashboard-constants';
import { useTranslations } from '@/lib/i18n';

const actionKeys: Record<string, string> = {
  extract: 'socialProof.extracted',
  whatsapp: 'socialProof.sent',
  export: 'socialProof.exported',
  ia: 'socialProof.generated',
};

export default function SocialProofWidget({
  proofIndex,
  proofVisible,
}: {
  proofIndex: number;
  proofVisible: boolean;
}) {
  const { t } = useTranslations();
  const msg = socialProofMsgs[proofIndex];

  return (
    <div
      className={`hidden lg:flex fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm px-4 py-3 bg-black/60 border border-white/10 rounded-2xl shadow-2xl items-center gap-3 hover:-translate-y-1 transition-all duration-500 cursor-default z-50 ${
        proofVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
      }`}
    >
      <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
        msg.type === 'whatsapp' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' :
        msg.type === 'ia' ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]' :
        msg.type === 'export' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]' :
        'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]'
      }`} />
      <p className="text-xs text-gray-300 font-medium leading-snug">
        <span className="text-white font-bold">{msg.name}</span>{' '}
        {t(actionKeys[msg.type] || 'socialProof.extracted')}{' '}
        <span className={`font-bold ${
          msg.type === 'whatsapp' ? 'text-green-400' :
          msg.type === 'ia' ? 'text-purple-400' :
          msg.type === 'export' ? 'text-amber-400' :
          'text-blue-400'
        }`}>{msg.detail}</span>{' '}
        <span className="text-gray-400">{msg.target}</span>
      </p>
    </div>
  );
}
