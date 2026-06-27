'use client';

export const SHARE_PLATFORMS = {
  whatsapp: { label: 'WhatsApp', icon: '💬', color: 'bg-green-500 hover:bg-green-400' },
  twitter: { label: 'Twitter / X', icon: '🐦', color: 'bg-blue-400 hover:bg-blue-300' },
  facebook: { label: 'Facebook', icon: '📘', color: 'bg-blue-600 hover:bg-blue-500' },
  email: { label: 'Email', icon: '📧', color: 'bg-gray-500 hover:bg-gray-400' },
  telegram: { label: 'Telegram', icon: '✈️', color: 'bg-sky-500 hover:bg-sky-400' },
  linkedin: { label: 'LinkedIn', icon: '💼', color: 'bg-blue-700 hover:bg-blue-600' },
  copy: { label: 'Copiar Link', icon: '📋', color: 'bg-amber-500 hover:bg-amber-400' },
};

type SharePlatform = keyof typeof SHARE_PLATFORMS;

interface ShareButtonsProps {
  url: string;
  text: string;
  platforms?: SharePlatform[];
  onCopy?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function getShareUrl(platform: SharePlatform, url: string, text: string): string {
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);
  switch (platform) {
    case 'whatsapp': return `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
    case 'twitter': return `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
    case 'facebook': return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`;
    case 'telegram': return `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
    case 'linkedin': return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    case 'email': return `mailto:?subject=GeoLeads&body=${encodedText}%20${encodedUrl}`;
    case 'copy': return '';
  }
}

export default function ShareButtons({ url, text, platforms = ['whatsapp', 'twitter', 'facebook', 'email', 'copy'], onCopy, size = 'md' }: ShareButtonsProps) {
  const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-1' : size === 'lg' ? 'text-sm px-4 py-2.5' : 'text-xs px-3 py-1.5';

  const handleShare = (platform: SharePlatform) => {
    if (platform === 'copy') {
      navigator.clipboard.writeText(url).then(() => {
        if (onCopy) onCopy();
      });
      return;
    }
    const shareUrl = getShareUrl(platform, url, text);
    if (typeof navigator !== 'undefined' && navigator.share && platform === 'whatsapp') {
      navigator.share({ url, text }).catch(() => {});
    } else {
      window.open(shareUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {platforms.map(platform => {
        const p = SHARE_PLATFORMS[platform];
        return (
          <button
            key={platform}
            onClick={() => handleShare(platform)}
            className={`${sizeClasses} rounded-lg ${p.color} text-black font-bold transition-all cursor-pointer flex items-center gap-1.5`}
            title={p.label}
          >
            <span className="text-base">{p.icon}</span>
            {size !== 'sm' && <span>{p.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
