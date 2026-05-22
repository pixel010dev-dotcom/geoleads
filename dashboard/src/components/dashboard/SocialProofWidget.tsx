'use client';

import { socialProofMsgs } from './dashboard-constants';

export default function SocialProofWidget({
  proofIndex,
  proofVisible,
}: {
  proofIndex: number;
  proofVisible: boolean;
}) {
  return (
    <div
      className={`hidden lg:flex fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm px-4 py-3 bg-black/60 border border-white/10 rounded-2xl shadow-2xl items-center gap-3 hover:-translate-y-1 transition-all duration-500 cursor-default z-50 ${
        proofVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
      }`}
    >
      <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
        socialProofMsgs[proofIndex].type === 'whatsapp' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' :
        socialProofMsgs[proofIndex].type === 'ia' ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]' :
        socialProofMsgs[proofIndex].type === 'export' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]' :
        'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]'
      }`} />
      <p className="text-xs text-gray-300 font-medium leading-snug">
        <span className="text-white font-bold">{socialProofMsgs[proofIndex].name}</span>{' '}
        {socialProofMsgs[proofIndex].action}{' '}
        <span className={`font-bold ${
          socialProofMsgs[proofIndex].type === 'whatsapp' ? 'text-green-400' :
          socialProofMsgs[proofIndex].type === 'ia' ? 'text-purple-400' :
          socialProofMsgs[proofIndex].type === 'export' ? 'text-amber-400' :
          'text-blue-400'
        }`}>{socialProofMsgs[proofIndex].detail}</span>{' '}
        <span className="text-gray-400">{socialProofMsgs[proofIndex].target}</span>
      </p>
    </div>
  );
}
