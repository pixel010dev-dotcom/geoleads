# GeoLeads - Código Completo do Motor de Extração (para Debug com IA)

## Problema Reportado
O motor de extração não entrega leads. O frontend mostra "Mapeou 15 empresas em 18s" mas na prática não retorna resultados consistentes.

---

## ARQUITETURA DO SISTEMA

```
Frontend (ExtractorSection.tsx)
    ↓ POST /api/extract
API Route (route.ts)
    ↓ runExtraction()
Runner (runner.ts)
    ↓ Executa 4 estratégias em paralelo
Estratégias:
  1. google-search.ts     → HTTP fetch Google Search/Maps
  2. bing-maps.ts         → HTTP fetch Bing Maps
  3. alternative-sources.ts → OpenStreetMap (Overpass API)
  4. duckduckgo.ts        → HTTP fetch DuckDuckGo HTML
    ↓ Resultados filtrados por scoreLeadQuality()
    ↓ Leads salvos no job via Supabase
Frontend pola /api/extract/job/{jobId} até completar
```

**IMPORTANTE**: A estratégia `maps-scraper.ts` (Playwright) NÃO é usada no runner. Está hardcoded como `EARLY EXIT` no runner.ts.

---

## 1. TYPES (lib/types.ts)

```typescript
export interface SearchLead {
  nome: string;
  telefone: string;
  site: string;
  endereco: string;
  avaliacao: string;
  reviewCount: string;
  categoria: string;
  horarios: string;
  cep: string;
  placeUrl: string;
  email: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  cnpj: string;
}

export function createEmptySearchLead(): SearchLead {
  return {
    nome: '', telefone: 'Não informado', site: 'Sem site', endereco: '',
    avaliacao: 'N/A', reviewCount: '', categoria: '', horarios: '', cep: '',
    placeUrl: '', email: '', instagram: '', facebook: '', tiktok: '', cnpj: ''
  };
}

export type ScoreQuality = 'high' | 'medium' | 'low' | 'trash';

export function scoreLeadQuality(lead: SearchLead): { score: number; tier: ScoreQuality } {
  let score = 0;
  if (lead.nome) score += 15;
  if (lead.telefone && lead.telefone !== 'Não informado') score += 20;
  if (lead.site && lead.site !== 'Sem site') score += 15;
  if (lead.endereco) score += 10;
  if (lead.email) score += 15;
  if (lead.cnpj) score += 10;
  if (lead.instagram) score += 5;
  if (lead.facebook) score += 5;
  if (lead.avaliacao !== 'N/A') score += 5;

  let tier: ScoreQuality;
  if (score >= 60) tier = 'high';
  else if (score >= 35) tier = 'medium';
  else if (score >= 15) tier = 'low';
  else tier = 'trash';

  return { score, tier };
}
```

---

## 2. VALIDATION (lib/validation.ts)

```typescript
const BAD_EMAIL_REGEX = /sentry|wix|example|schema|wordpress|localhost|yourdomain|domain\.com|noreply|no-reply/i;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const CNPJ_REGEX = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/;

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return raw;
  if (/(\d)\1{5,}/.test(digits)) return 'Não informado';
  if (digits.startsWith('55') && digits.length >= 12) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  }
  if (digits.length >= 13 && !digits.startsWith('55')) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  }
  if (digits.length >= 10 && digits.length <= 11) {
    const ddd = parseInt(digits.slice(0, 2), 10);
    const isValidBR = (ddd >= 11 && ddd <= 19) || (ddd >= 21 && ddd <= 28) ||
      (ddd >= 31 && ddd <= 38) || (ddd >= 41 && ddd <= 49) ||
      (ddd >= 51 && ddd <= 59) || (ddd >= 61 && ddd <= 69) ||
      (ddd >= 71 && ddd <= 79) || (ddd >= 81 && ddd <= 89) ||
      (ddd >= 91 && ddd <= 99);
    if (isValidBR) {
      return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
    }
    return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
  }
  return 'Não informado';
}

export function isBusinessWebsiteCandidate(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (!/^https?:$/.test(url.protocol)) return false;
    if (host.includes('google.') || host.includes('googleapis.') || host.includes('gstatic.') ||
        host.includes('youtube.') || host.includes('instagram.com') || host.includes('facebook.com') ||
        host.includes('tiktok.com') || host.includes('whatsapp.com') || host.includes('wa.me')) return false;
    return true;
  } catch {
    return false;
  }
}

export function pickEmail(html: string): string {
  const matches = Array.from(html.matchAll(EMAIL_REGEX), match => match[0]);
  return matches.find(email => !BAD_EMAIL_REGEX.test(email)) || '';
}

export function pickCnpj(html: string): string {
  const match = html.match(CNPJ_REGEX);
  if (!match) return '';
  return match[0];
}
```

---

## 3. STEALTH (lib/stealth.ts)

```typescript
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
];

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export function getRandomHeaders(): Record<string, string> {
  return {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8,es;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.google.com/',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Sec-CH-UA': '"Google Chrome";v="125", "Chromium";v="125", "Not=A?Brand";v="24"',
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Platform': '"Windows"',
  };
}
```

---

## 4. NORMALIZERS (lib/normalizers.ts) - Resumo

```typescript
// Mapa de nichos para tags OpenStreetMap
export const NICHE_TO_OSM_TAGS: Record<string, string[]> = {
  'academia': ['amenity=gym', 'leisure=fitness_centre', 'sport=fitness'],
  'dentista': ['amenity=clinic', 'healthcare=dentist'],
  'restaurante': ['amenity=restaurant', 'amenity=fast_food', 'amenity=bar', 'amenity=cafe'],
  'advogado': ['office=lawyer', 'office=attorney'],
  'medico': ['amenity=clinic', 'healthcare=doctor'],
  'estetica': ['shop=beauty', 'shop=hairdresser'],
  'petshop': ['shop=pet', 'amenity=veterinary'],
  'imobiliaria': ['office=estate_agent'],
  'contabilidade': ['office=accountant'],
  'oficina': ['shop=car_repair', 'craft=mechanic'],
  'supermercado': ['shop=supermarket'],
  'padaria': ['shop=bakery'],
  'farmacia': ['amenity=pharmacy'],
  'escola': ['amenity=school'],
  'hotel': ['tourism=hotel', 'tourism=hostel'],
};

// Normalização de localização
export function smartNormalizeQuery(keyword: string, location: string) {
  // Corrige typos: "acadimia" → "academia"
  // Normaliza localização: "sp" → "São Paulo", "curitba" → "Curitiba"
  // Retorna keyword e location corrigidos
}

export function isBroadLocation(location: string): boolean {
  // Detecta "Brasil", "nacional", "país inteiro" etc.
}
```

---

## 5. RUNNER (runner.ts) - Orquestrador

```typescript
import type { SearchLead } from './lib/types';
import { scoreLeadQuality } from './lib/types';
import { extractFromGoogleSearch } from './strategies/google-search';
import { extractFromBingMaps } from './strategies/bing-maps';
import { extractFromOpenStreetMap } from './strategies/alternative-sources';
import { extractFromDuckDuckGo } from './strategies/duckduckgo';

export async function runExtraction(config: RunnerConfig): Promise<SearchLead[]> {
  const {
    keyword, location, targetLimit, filterRule, isBroadRegion,
    existingLeadKeys, onProgress, onDone, shouldCancel,
    maxTimeMs = isBroadRegion ? 120000 : Math.min(90000, Math.max(25000, targetLimit * 1200))
  } = config;

  const startTime = Date.now();
  const leadsByName = new Map<string, SearchLead>();
  const scrapedNames = new Set<string>(existingLeadKeys.map(k => k.split('|')[0]).filter(Boolean));
  let scannedTotal = 0;
  let citiesDone = 0;
  let blockedDetected = false;

  // ... (funções addLead, processResults, notify)

  // PHASE 1: PARALLEL fetch (OSM + Google + Bing + DuckDuckGo)
  const fetchPromises = [
    extractFromOpenStreetMap(keyword, location, targetLimit, existingForFetch),
    extractFromGoogleSearch(keyword, location, targetLimit, existingForFetch, cfWorkerUrl ? { cfWorkerUrl } : undefined),
    extractFromBingMaps(keyword, location, targetLimit, existingForFetch),
    extractFromDuckDuckGo(keyword, location, targetLimit, existingForFetch),
  ];

  // ... (processa resultados)

  // EARLY EXIT: SEMPRE entrega o que a Fase 1 encontrou. Sem fallback Playwright.
  const validLeads = leads
    .map(l => ({ lead: l, score: scoreLeadQuality(l) }))
    .filter(s => s.score.tier !== 'trash')  // ← FILTRO AQUI
    .map(s => s.lead)
    .filter(l => postFilter(l, filterRule))
    .slice(0, targetLimit);

  return validLeads;
}
```

---

## 6. GOOGLE SEARCH STRATEGY (strategies/google-search.ts)

```typescript
export async function extractFromGoogleSearch(
  keyword: string, location: string, targetLimit: number,
  existingKeys: Set<string>, options?: { cfWorkerUrl?: string }
): Promise<{ leads: SearchLead[]; blocked: boolean }> {
  const allLeads: SearchLead[] = [];
  let blocked = false;

  const queryFormats = [`${keyword} ${location}`];

  for (const queryFormat of queryFormats) {
    const query = queryFormat.replace(/\s+/g, ' ').trim();
    const encodedQuery = encodeURIComponent(query);

    const urls = [
      `https://www.google.com.br/maps/search/${encodedQuery}?hl=pt-BR&gl=br`,
      `https://www.google.com/search?q=${encodedQuery}+endereço+telefone&hl=pt-BR&gl=br`,
    ];

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          headers: getRandomHeaders(),
          redirect: 'follow',
          signal: AbortSignal.timeout(12000),
        });

        const html = await response.text();

        if (isBlockedPage(html, url)) {
          blocked = true;
          continue;
        }

        // Tenta 3 parsers:
        // 1. parseLdJsonFromSearch() - dados estruturados
        // 2. parseGoogleMapsSearch() - URLs do Maps
        // 3. parseSearchResultHtml() - resultados gerais
        let newLeads = [];
        const ldLeads = parseLdJsonFromSearch(html);
        if (ldLeads.length > 0) newLeads.push(...ldLeads);
        const mapsLeads = parseGoogleMapsSearch(html);
        if (mapsLeads.length > 0) newLeads.push(...mapsLeads);
        if (newLeads.length === 0) {
          newLeads.push(...parseSearchResultHtml(html));
        }

        // Adiciona leads únicos
        for (const lead of newLeads) {
          const nameKey = lead.nome.toLowerCase();
          if (!seenNames.has(nameKey) && !existingKeys.has(nameKey)) {
            seenNames.add(nameKey);
            allLeads.push(lead);
          }
        }
      } catch (e) { console.error(e); }

      await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
    }
  }

  return { leads: allLeads, blocked };
}
```

---

## 7. BING MAPS STRATEGY (strategies/bing-maps.ts)

```typescript
export async function extractFromBingMaps(
  keyword: string, location: string, targetLimit: number, existingKeys: Set<string>
): Promise<SearchLead[]> {
  const leads: SearchLead[] = [];
  const seenNames = new Set<string>();

  const queryVariants = [`${keyword} ${location}`, `${keyword} em ${location}`];

  for (const query of queryVariants) {
    try {
      const url = `https://www.bing.com/maps?q=${encodeURIComponent(query)}&lvl=13&setLang=pt-BR`;
      const response = await fetch(url, {
        headers: { 'User-Agent': getRandomUserAgent(), 'Accept-Language': 'pt-BR' },
        signal: AbortSignal.timeout(15000),
      });

      const html = await response.text();

      // Tenta parse JSON de entities
      const jsonBlobs = html.match(/\"entities\":\s*\[(\{[^]]*\})\]/g) || [];
      // ... parse entities

      // Fallback: regex de nomes
      const nameRegex = /\"name\"\s*:\s*\"([^\"]{3,100})\"/gi;
      // ... extrai nome, telefone, URL
    } catch (e) { console.error(e); }
  }

  return leads;
}
```

---

## 8. DUCKDUCKGO STRATEGY (strategies/duckduckgo.ts)

```typescript
export async function extractFromDuckDuckGo(
  keyword: string, location: string, targetLimit: number, existingKeys: Set<string>
): Promise<SearchLead[]> {
  const leads: SearchLead[] = [];

  const queryVariants = [
    `${keyword} ${location} endereço telefone`,
    `${keyword} em ${location} contato`,
  ];

  for (const query of queryVariants) {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=br-pt`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 ...', 'Accept-Language': 'pt-BR' },
        signal: AbortSignal.timeout(10000),
      });

      const html = await response.text();

      // Parse: result__a (títulos) + result__snippet (trechos)
      const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

      // Para cada resultado: extrai nome, telefone do snippet, site
    } catch (e) { console.error('[DuckDuckGo]', e); }
  }

  return leads;
}
```

---

## 9. OSM STRATEGY (strategies/alternative-sources.ts)

```typescript
export async function extractFromOpenStreetMap(
  keyword: string, location: string, targetLimit: number, existingKeys: Set<string>
): Promise<SearchLead[]> {
  const leads: SearchLead[] = [];

  // 1. Geolocaliza a cidade via Nominatim
  const geo = await geocodeLocation(location);
  if (!geo) return leads;

  // 2. Mapeia nicho para tags OSM
  const osmTags = NICHE_TO_OSM_TAGS[kwLower] || [];

  // 3. Monta query Overpass
  const tagFilters = [];
  for (const tag of osmTags) {
    const [key, value] = tag.split('=');
    tagFilters.push(`nwr["${key}"="${value}"](${geo.bbox})`);
  }
  tagFilters.push(`nwr[name~"${kwLower}",i](${geo.bbox})`);

  const query = `[out:json][timeout:15];\n(${tagFilters.join(';\n')};\n);\nout body;`;

  // 4. Executa query
  const results = await runOverpass(query, 20000);

  // 5. Converte elementos para SearchLead
  for (const el of results) {
    const lead = osmElementToLead(el);
    if (lead && !seenNames.has(lead.nome.toLowerCase())) {
      leads.push(lead);
    }
  }

  return leads;
}
```

---

## 10. API ROUTE (route.ts)

```typescript
export async function POST(request: Request) {
  // 1. Autentica usuário
  auth = await getAuthUser(request);

  // 2. Valida input
  const { keyword, location, limit, filterRule } = await request.json();

  // 3. Normaliza query
  const { correctedKeyword, correctedLocation } = smartNormalizeQuery(keyword, location);

  // 4. Cria job no Supabase
  const { data: jobData } = await requestSupabase.from('extraction_jobs').insert({...}).select('id').single();

  // 5. Dispara extração em background
  runExtraction({
    keyword, location, targetLimit, filterRule,
    onProgress: (leads, scanned, citiesDone, message) => {
      updateJob(jobId, { leads, leads_count: leads.length, scanned, ... });
    },
    onDone: async (result) => {
      await updateJob(jobId, {
        status: result.error ? 'failed' : 'completed',
        leads: result.leads,
        delivered: true,
      });
      // Deduz tokens
      await requestSupabase.rpc('deduct_tokens', { p_user_id, p_amount: result.leads.length });
    },
  });

  return NextResponse.json({ success: true, jobId });
}
```

---

## 11. FRONTEND - Dashboard Page (page.tsx) - Trecho do handleExtract

```typescript
const handleExtract = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsExtracting(true);

  const res = await fetch('/api/extract', {
    method: 'POST',
    body: JSON.stringify({ keyword, location, limit, filterRule, existingLeadKeys })
  });
  const data = await res.json();

  if (data.success && data.jobId) {
    startPolling(data.jobId);  // Poll a cada 3s
  }
};

// Polling
const startPolling = (jobId: string) => {
  pollRef.current = setInterval(async () => {
    const res = await fetch(`/api/extract/job/${jobId}`);
    const data = await res.json();
    if (data.job.status === 'completed') {
      setLeads(data.job.leads);
      setIsExtracting(false);
      clearInterval(pollRef.current);
    }
  }, 3000);
};
```

---

## ANÁLISE DE PROBLEMAS

### Problema 1: Google/Bing bloqueiam requests HTTP
- **Causa**: IPs de data center (Railway) são bloqueados
- **Evidência**: `isBlockedPage()` detecta captcha/sorry mas não tem fallback
- **Solução**: Usar proxy residencial ou API oficial

### Problema 2: Playwright está desativado
- **Causa**: Runner.ts tem "EARLY EXIT" hardcoded
- **Evidência**: `maps-scraper.ts` tem código completo mas nunca é chamado
- **Solução**: Ativar Playwright como fallback quando HTTP falhar

### Problema 3: Timeouts muito curtos
- **Causa**: Google=12s, Bing=15s, DDG=10s, OSM=15s
- **Evidência**: Railway pode ter latência alta
- **Solução**: Aumentar timeouts ou usar retry

### Problema 4: Parsing regex frágil
- **Causa**: Google muda HTML frequentemente
- **Evidência**: Regex como `/<h3[^>]*>([\s\S]*?)<\/h3>/` podem estar desatualizados
- **Solução**: Usar APIs estruturadas (Google Places API)

### Problema 5: scoreLeadQuality descarta leads
- **Causa**: Lead só com nome = score 15 = 'trash'
- **Evidência**: Se estratégias retornam só nome, tudo é filtrado
- **Solução**: Reduzir threshold ou melhorar extração de dados

### Problema 6: CF_WORKER_URL não configurado
- **Causa**: Variável de ambiente para proxy via Cloudflare Worker
- **Evidência**: Se vazia, requests vão direto ao Google
- **Solução**: Configurar CF_WORKER_URL ou usar proxy alternativo

---

## PERGUNTAS PARA A IA MAIS FORTE

1. Qual a melhor abordagem para extrair leads de Google Maps sem ser bloqueado?
2. Deveria usar uma API oficial (Google Places API) em vez de scraping?
3. Como configurar proxies residenciais no Railway para evitar bloqueios?
4. O regex de parsing de HTML do Google está correto para a estrutura atual?
5. Deveria usar Playwright com stealth plugin em vez de fetch()?
6. Como melhorar o scoreLeadQuality para não descartar leads úteis?
7. Vale a pena usar SerpAPI ou similar como proxy para Google Search?
8. Como testar se os requests HTTP estão sendo bloqueados?
9. Qual a melhor estratégia de fallback quando uma fonte falha?
10. Como monitorar a taxa de sucesso de cada estratégia?
