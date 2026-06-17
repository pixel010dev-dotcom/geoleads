import type { SearchLead } from '../lib/types';
import { createEmptySearchLead } from '../lib/types';
import { normalizePhone, isBusinessWebsiteCandidate } from '../lib/validation';
import { getRandomUserAgent } from '../lib/stealth';

export async function extractFromBingMaps(
  keyword: string,
  location: string,
  targetLimit: number,
  existingKeys: Set<string>
): Promise<SearchLead[]> {
  const leads: SearchLead[] = [];
  const seenNames = new Set<string>();
  const seenPhones = new Set<string>();

  const queryVariants = [
    `${keyword} ${location}`,
    `${keyword} em ${location}`,
  ];

  for (const query of queryVariants) {
    if (leads.length >= targetLimit) break;

    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://www.bing.com/maps?q=${encodedQuery}&lvl=13&setLang=pt-BR`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        },
        redirect: 'follow',
      });

      if (!response.ok) continue;

      const html = await response.text();

      const nameRegex = /"name"\s*:\s*"([^"]+)"|"businessName"\s*:\s*"([^"]+)"/gi;
      let nameMatch: RegExpExecArray | null;
      while ((nameMatch = nameRegex.exec(html)) !== null && leads.length < targetLimit) {
        const name = nameMatch[1] || nameMatch[2];
        if (!name || seenNames.has(name.toLowerCase())) continue;
        seenNames.add(name.toLowerCase());

        const lead = createEmptySearchLead();
        lead.nome = name;
        leads.push(lead);
      }

      const phoneRegex = /"phone"\s*:\s*"([^"]+)"|"telephone"\s*:\s*"([^"]+)"|"telefone"\s*:\s*"([^"]+)"/gi;
      let phoneMatch: RegExpExecArray | null;
      while ((phoneMatch = phoneRegex.exec(html)) !== null) {
        const phone = phoneMatch[1] || phoneMatch[2] || phoneMatch[3];
        if (!phone || seenPhones.has(phone)) continue;
        seenPhones.add(phone);
      }

      await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
    } catch {}
  }

  return leads;
}
