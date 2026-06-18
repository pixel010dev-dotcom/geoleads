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

      const businessRegex = /"name"\s*:\s*"([^"]+)"\s*,\s*"phone"\s*:\s*"([^"]+)"/gi;
      let bizMatch: RegExpExecArray | null;
      while ((bizMatch = businessRegex.exec(html)) !== null && leads.length < targetLimit) {
        const name = bizMatch[1];
        const phone = bizMatch[2];
        if (!name || seenNames.has(name.toLowerCase())) continue;
        seenNames.add(name.toLowerCase());

        const lead = createEmptySearchLead();
        lead.nome = name;
        if (phone && !seenPhones.has(phone)) {
          seenPhones.add(phone);
          lead.telefone = normalizePhone(phone);
        }
        leads.push(lead);
      }

      if (leads.length < targetLimit) {
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
        const phoneMatches: string[] = [];
        let phoneExec: RegExpExecArray | null;
        while ((phoneExec = phoneRegex.exec(html)) !== null) {
          const phone = phoneExec[1] || phoneExec[2] || phoneExec[3];
          if (!phone || seenPhones.has(phone)) continue;
          seenPhones.add(phone);
          phoneMatches.push(phone);
        }
        if (phoneMatches.length > 0 && leads.length > 0) {
          for (let i = 0; i < leads.length && i < phoneMatches.length; i++) {
            if (leads[i].telefone === 'Não informado') {
              leads[i].telefone = normalizePhone(phoneMatches[i]);
            }
          }
        }
      }

      await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
    } catch {}
  }

  return leads;
}
