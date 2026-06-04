"use client";

const gradId = (name: string) => `feature-grad-${name}`;

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#8b5cf6" />
      </linearGradient>
    </defs>
  );
}

export function IconSearch({ className }: { className?: string }) {
  const id = 'search';
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={`url(#${gradId(id)})`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <Defs id={gradId(id)} />
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
    </svg>
  );
}

export function IconPhone({ className }: { className?: string }) {
  const id = 'phone';
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={`url(#${gradId(id)})`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <Defs id={gradId(id)} />
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

export function IconBuilding({ className }: { className?: string }) {
  const id = 'building';
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={`url(#${gradId(id)})`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <Defs id={gradId(id)} />
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M8 10h.01" />
      <path d="M16 10h.01" />
      <path d="M8 14h.01" />
      <path d="M16 14h.01" />
    </svg>
  );
}

export function IconMail({ className }: { className?: string }) {
  const id = 'mail';
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={`url(#${gradId(id)})`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <Defs id={gradId(id)} />
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7l-10 7L2 7" />
    </svg>
  );
}

export function IconCamera({ className }: { className?: string }) {
  const id = 'camera';
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={`url(#${gradId(id)})`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <Defs id={gradId(id)} />
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <circle cx="12" cy="13" r="4" />
      <path d="M17 6l-1-2h-8L7 6" />
    </svg>
  );
}

export function IconWhatsApp({ className }: { className?: string }) {
  const id = 'whatsapp';
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={`url(#${gradId(id)})`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <Defs id={gradId(id)} />
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      <path d="M9 9c.5-.5 1.2-.5 1.7 0l1.3 1.3c.5.5.5 1.2 0 1.7l-.7.7c-.5.5-.5 1.2 0 1.7l1.3 1.3c.5.5 1.2.5 1.7 0l.7-.7c.5-.5 1.2-.5 1.7 0l1.3 1.3c.5.5.5 1.2 0 1.7C17 18 15.5 18 14.5 17c-1.3-.5-2.5-1.3-3.4-2.3-.9-1-1.6-2.1-2-3.4-.3-1 .2-2.5 1.3-3l.6-.3z" />
    </svg>
  );
}

export function IconBot({ className }: { className?: string }) {
  const id = 'bot';
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={`url(#${gradId(id)})`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <Defs id={gradId(id)} />
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M12 2v4" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
      <circle cx="16" cy="8" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconChart({ className }: { className?: string }) {
  const id = 'chart';
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={`url(#${gradId(id)})`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <Defs id={gradId(id)} />
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
      <path d="M15 21V9" />
    </svg>
  );
}

export function IconDownload({ className }: { className?: string }) {
  const id = 'download';
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={`url(#${gradId(id)})`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <Defs id={gradId(id)} />
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

export const featureIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  search: IconSearch,
  phone: IconPhone,
  building: IconBuilding,
  mail: IconMail,
  camera: IconCamera,
  whatsapp: IconWhatsApp,
  bot: IconBot,
  chart: IconChart,
  download: IconDownload,
};
