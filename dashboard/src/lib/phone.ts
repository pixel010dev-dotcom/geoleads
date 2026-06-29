const BR_DDD = (d: number) =>
  (d >= 11 && d <= 19) || (d >= 21 && d <= 28) ||
  (d >= 31 && d <= 38) || (d >= 41 && d <= 49) ||
  (d >= 51 && d <= 59) || (d >= 61 && d <= 69) ||
  (d >= 71 && d <= 79) || (d >= 81 && d <= 89) ||
  (d >= 91 && d <= 99);

export function toWhatsAppNumber(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.length < 10 || d.length > 15) return d;

  if (!d.startsWith('55')) {
    if (d.length === 10) {
      const ddd = parseInt(d.slice(0, 2), 10);
      if (BR_DDD(ddd)) d = '55' + d.slice(0, 2) + '9' + d.slice(2);
      else d = '55' + d;
    } else if (d.length === 11) {
      d = '55' + d;
    } else {
      d = '55' + d;
    }
  } else if (d.length === 12) {
    const ddd = parseInt(d.slice(2, 4), 10);
    if (BR_DDD(ddd)) d = d.slice(0, 4) + '9' + d.slice(4);
  }

  return d;
}

export function toWhatsAppJid(raw: string): string | null {
  const num = toWhatsAppNumber(raw);
  if (num.length < 10 || num.length > 15) return null;
  return `${num}@s.whatsapp.net`;
}

export function formatPhoneDisplay(raw: string): string {
  const d = toWhatsAppNumber(raw);
  if (d.startsWith('55') && d.length >= 12) {
    if (d.length === 13) return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8, 12)}`;
  }
  return raw;
}
