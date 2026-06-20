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

  const queryVariants = [
    `${keyword} ${location}`,
    `${keyword} em ${location}`,
  ];

  for (const query of queryVariants) {
    if (leads.length >= targetLimit) break;

    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://www.bing.com/maps?q=${encodedQuery}&lvl=13&setLang=pt-BR&FORM=HDRSC6`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          'Referer': 'https://www.bing.com/',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) continue;

      const html = await response.text();

      const jsonBlobs = html.match(/\"entities\":\s*\[(\{[^]]*\})\]/g) || [];
      for (const blob of jsonBlobs) {
        try {
          const entitiesStr = blob.replace(/^"entities":\s*/, '');
          const entities = JSON.parse(entitiesStr);
          for (const entity of entities) {
            if (leads.length >= targetLimit) break;
            const name = entity.name || entity.displayName || '';
            if (!name || seenNames.has(name.toLowerCase())) continue;
            seenNames.add(name.toLowerCase());

            const lead = createEmptySearchLead();
            lead.nome = name;

            if (entity.phone) lead.telefone = normalizePhone(String(entity.phone));
            if (entity.address) {
              const addr = typeof entity.address === 'string' ? entity.address :
                [entity.address.street, entity.address.city, entity.address.state, entity.address.postalCode].filter(Boolean).join(', ');
              if (addr) lead.endereco = addr;
            }
            if (entity.url && isBusinessWebsiteCandidate(entity.url)) lead.site = entity.url;
            if (entity.rating) lead.avaliacao = String(entity.rating);
            if (entity.categoryName) lead.categoria = entity.categoryName;

            leads.push(lead);
          }
        } catch (e) { console.error(e); }
      }

      if (leads.length < targetLimit) {
        const nameRegex = /\"name\"\s*:\s*\"([^\"]{3,100})\"/gi;
        let nameMatch: RegExpExecArray | null;
        while ((nameMatch = nameRegex.exec(html)) !== null && leads.length < targetLimit) {
          const name = nameMatch[1];
          if (!name || seenNames.has(name.toLowerCase())) continue;
          if (/bing|microsoft| maps |search|login|sign|account|privacy/i.test(name)) continue;
          seenNames.add(name.toLowerCase());

          const lead = createEmptySearchLead();
          lead.nome = name;

          const region = html.slice(Math.max(0, nameMatch.index - 200), nameMatch.index + 500);
          const phoneMatch = region.match(/\"phone\"\s*:\s*\"([^\"]+)\"/);
          if (phoneMatch) lead.telefone = normalizePhone(phoneMatch[1]);

          const urlMatch = region.match(/\"url\"\s*:\s*\"(https?:\/\/[^\"]+)\"/);
          if (urlMatch && isBusinessWebsiteCandidate(urlMatch[1])) lead.site = urlMatch[1];

          const addrMatch = region.match(/\"address\"\s*:\s*\{([^}]+)\}/);
          if (addrMatch) {
            const streetM = addrMatch[1].match(/\"street\"\s*:\s*\"([^\"]+)\"/);
            const cityM = addrMatch[1].match(/\"city\"\s*:\s*\"([^\"]+)\"/);
            const parts = [streetM?.[1], cityM?.[1]].filter(Boolean);
            if (parts.length > 0) lead.endereco = parts.join(', ');
          }

          leads.push(lead);
        }
      }

      await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
    } catch (e) { console.error(e); }
  }

  return leads;
}
