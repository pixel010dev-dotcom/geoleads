// Runner Turbo — Extração em paralelo com expansão de localização GLOBAL
// Funciona pra qualquer país: descobre cidades automaticamente via API do Google

import type { SearchLead } from './lib/types';
import { extractFromGooglePlaces, type PlacesApiResult } from './strategies/google-places';

export interface RunnerResult {
  leads: SearchLead[];
  scanned: number;
  citiesDone: number;
  totalTimeMs: number;
  error?: string;
}

export interface RunnerConfig {
  keyword: string;
  location: string;
  targetLimit: number;
  filterRule: string;
  isBroadRegion: boolean;
  existingLeadKeys: string[];
  onProgress?: (leads: SearchLead[], scanned: number, citiesDone: number, message: string) => void;
  onDone?: (result: RunnerResult) => void | Promise<void>;
  shouldCancel?: () => Promise<boolean>;
  maxTimeMs?: number;
}

// ========== DADOS BRASIL (hardcoded — otimizado) ==========
const BRAZIL_STATES: { name: string; uf: string; cities: string[] }[] = [
  { name: 'Acre', uf: 'AC', cities: ['Rio Branco'] },
  { name: 'Alagoas', uf: 'AL', cities: ['Maceió', 'Arapiraca'] },
  { name: 'Amapá', uf: 'AP', cities: ['Macapá'] },
  { name: 'Amazonas', uf: 'AM', cities: ['Manaus', 'Parintins'] },
  { name: 'Bahia', uf: 'BA', cities: ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Ilhéus', 'Porto Seguro'] },
  { name: 'Ceará', uf: 'CE', cities: ['Fortaleza', 'Juazeiro do Norte', 'Sobral'] },
  { name: 'Distrito Federal', uf: 'DF', cities: ['Brasília', 'Taguatinga', 'Ceilândia'] },
  { name: 'Espírito Santo', uf: 'ES', cities: ['Vitória', 'Vila Velha', 'Cariacica', 'Serra'] },
  { name: 'Goiás', uf: 'GO', cities: ['Goiânia', 'Anápolis', 'Rio Verde'] },
  { name: 'Maranhão', uf: 'MA', cities: ['São Luís', 'Imperatriz', 'Caxias'] },
  { name: 'Mato Grosso', uf: 'MT', cities: ['Cuiabá', 'Várzea Grande', 'Rondonópolis'] },
  { name: 'Mato Grosso do Sul', uf: 'MS', cities: ['Campo Grande', 'Dourados'] },
  { name: 'Minas Gerais', uf: 'MG', cities: ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Montes Claros'] },
  { name: 'Pará', uf: 'PA', cities: ['Belém', 'Santarém', 'Ananindeua', 'Marabá'] },
  { name: 'Paraíba', uf: 'PB', cities: ['João Pessoa', 'Campina Grande'] },
  { name: 'Paraná', uf: 'PR', cities: ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel'] },
  { name: 'Pernambuco', uf: 'PE', cities: ['Recife', 'Olinda', 'Caruaru', 'Petrolina'] },
  { name: 'Piauí', uf: 'PI', cities: ['Teresina', 'Parnaíba'] },
  { name: 'Rio de Janeiro', uf: 'RJ', cities: ['Rio de Janeiro', 'Niterói', 'Duque de Caxias', 'Nova Iguaçu', 'Campos dos Goytacazes'] },
  { name: 'Rio Grande do Norte', uf: 'RN', cities: ['Natal', 'Mossoró'] },
  { name: 'Rio Grande do Sul', uf: 'RS', cities: ['Porto Alegre', 'Caxias do Sul', 'Pelotas', 'Santa Maria', 'Novo Hamburgo'] },
  { name: 'Rondônia', uf: 'RO', cities: ['Porto Velho', 'Ji-Paraná'] },
  { name: 'Roraima', uf: 'RR', cities: ['Boa Vista'] },
  { name: 'Santa Catarina', uf: 'SC', cities: ['Florianópolis', 'Joinville', 'Blumenau', 'São José'] },
  { name: 'São Paulo', uf: 'SP', cities: ['São Paulo', 'Campinas', 'São Bernardo do Campo', 'Santo André', 'Ribeirão Preto'] },
  { name: 'Sergipe', uf: 'SE', cities: ['Aracaju', 'Nossa Senhora do Socorro'] },
  { name: 'Tocantins', uf: 'TO', cities: ['Palmas', 'Araguaína'] },
];

/** Cache de descoberta de cidades por país */
const cityDiscoveryCache = new Map<string, string[]>();

function normalizeState(name: string): string {
  const n = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return n.replace(/^estado\s+(d[eo]\s+)?/i, '').trim();
}

/**
 * Descobre cidades de QUALQUER país usando a própria Places API.
 * Ex: USA → ["New York", "Los Angeles", "Chicago", ...]
 * Ex: Italia → ["Roma", "Milano", "Napoli", ...]
 * Usa busca "cities in {country}" e extrai os nomes.
 */
async function discoverCitiesViaPlaces(country: string): Promise<string[]> {
  const cacheKey = country.toLowerCase().trim();

  // Cache pra evitar chamadas repetidas
  if (cityDiscoveryCache.has(cacheKey)) {
    return cityDiscoveryCache.get(cacheKey)!;
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  const queries = [
    `major cities in ${country}`,
    `big cities in ${country}`,
  ];

  const allCities = new Set<string>();
  const skipWords = new Set([
    'city', 'cities', 'state', 'province', 'region', 'island',
    'capital', 'country', 'district', 'county', 'municipality',
    'town', 'village', 'metro', 'metropolitan',
  ]);

  for (const query of queries) {
    try {
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.displayName',
        },
        body: JSON.stringify({ textQuery: query, maxResultCount: 20 }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) continue;

      const data = await response.json();
      if (!data.places) continue;

      for (const place of data.places) {
        const name = place.displayName?.text?.trim();
        if (!name) continue;
        if (name.length < 4) continue; // muito curto pra ser cidade

        // Filtra palavras genéricas (ex: "The City", "Capital Region")
        const words = name.toLowerCase().split(/\s+/);
        const onlyGeneric = words.every((w: string) => skipWords.has(w) || w.length < 3);
        if (onlyGeneric) continue;

        // Remove sufixos tipo " city", " metropolitan area"
        const clean = name.replace(/\s+(city|metropolitan area|metro area|province|region)\s*$/i, '').trim();
        if (clean.length >= 3) allCities.add(clean);
      }
    } catch { /* ignora erro de uma query */ }
  }

  const result = Array.from(allCities).slice(0, 20); // max 20 cidades
  cityDiscoveryCache.set(cacheKey, result);
  return result;
}

// ========== PAÍSES CONHECIDOS (fallback pra casos comuns) ==========
const KNOWN_COUNTRIES: Record<string, string[]> = {
  'usa': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte', 'Indianapolis', 'San Francisco', 'Seattle', 'Denver', 'Washington'],
  'united states': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte', 'Indianapolis', 'San Francisco', 'Seattle', 'Denver', 'Washington'],
  'estados unidos': ['Nova York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Filadélfia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'San Francisco', 'Seattle', 'Denver', 'Washington'],
  'eua': ['Nova York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Filadélfia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'San Francisco', 'Seattle', 'Denver', 'Washington'],
  'uk': ['Londres', 'Manchester', 'Birmingham', 'Liverpool', 'Bristol', 'Sheffield', 'Leeds', 'Edimburgo', 'Glasgow', 'Newcastle'],
  'united kingdom': ['Londres', 'Manchester', 'Birmingham', 'Liverpool', 'Bristol', 'Sheffield', 'Leeds', 'Edimburgo', 'Glasgow', 'Newcastle'],
  'reino unido': ['Londres', 'Manchester', 'Birmingham', 'Liverpool', 'Bristol', 'Sheffield', 'Leeds', 'Edimburgo', 'Glasgow', 'Newcastle'],
  'inglaterra': ['Londres', 'Manchester', 'Birmingham', 'Liverpool', 'Bristol', 'Sheffield', 'Leeds', 'Newcastle'],
  'canada': ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Edmonton', 'Ottawa', 'Winnipeg', 'Quebec'],
  'canadá': ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Edmonton', 'Ottawa', 'Winnipeg', 'Quebec'],
  'australia': ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Newcastle', 'Canberra'],
  'austrália': ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Newcastle', 'Canberra'],
  'mexico': ['Cidade do México', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León', 'Cancún'],
  'méxico': ['Cidade do México', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León', 'Cancún'],
  'espanha': ['Madri', 'Barcelona', 'Valência', 'Sevilha', 'Bilbao', 'Málaga', 'Zaragoza', 'Murcia', 'Palma'],
  'italia': ['Roma', 'Milão', 'Nápoles', 'Turim', 'Palermo', 'Gênova', 'Bolonha', 'Florença', 'Veneza'],
  'itália': ['Roma', 'Milão', 'Nápoles', 'Turim', 'Palermo', 'Gênova', 'Bolonha', 'Florença', 'Veneza'],
  'frança': ['Paris', 'Marselha', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Estrasburgo', 'Montpellier', 'Bordeaux'],
  'alemanha': ['Berlim', 'Hamburgo', 'Munique', 'Colônia', 'Frankfurt', 'Estugarda', 'Düsseldorf', 'Leipzig', 'Dortmund'],
  'portugal': ['Lisboa', 'Porto', 'Braga', 'Coimbra', 'Funchal', 'Aveiro', 'Faro'],
  'argentina': ['Buenos Aires', 'Córdoba', 'Rosário', 'Mendoza', 'La Plata', 'Mar del Plata'],
  'japão': ['Tóquio', 'Osaka', 'Yokohama', 'Nagoya', 'Sapporo', 'Fukuoka', 'Kobe', 'Kyoto'],
  'japao': ['Tóquio', 'Osaka', 'Yokohama', 'Nagoya', 'Sapporo', 'Fukuoka', 'Kobe', 'Kyoto'],
  'china': ['Xangai', 'Pequim', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Nanquim', 'Hangzhou', 'Wuhan'],
  'india': ['Mumbai', 'Déli', 'Bangalore', 'Hyderabad', 'Chennai', 'Calcutá', 'Jaipur', 'Pune'],
  'índia': ['Mumbai', 'Déli', 'Bangalore', 'Hyderabad', 'Chennai', 'Calcutá', 'Jaipur', 'Pune'],
  'europa': ['Londres', 'Paris', 'Berlim', 'Madri', 'Roma', 'Barcelona', 'Amsterdã', 'Viena', 'Praga', 'Milão', 'Lisboa', 'Dublin', 'Bruxelas', 'Zurique', 'Munique'],
};

/**
 * Expande QUALQUER localização ampla em sub-localizações.
 *
 * Funciona pra qualquer país:
 * - "Brasil" → 27 estados (hardcoded)
 * - "USA" → 20 principais cidades (hardcoded + API discovery)
 * - "Italia" → cidades italianas (hardcoded + API discovery)
 * - "Europa" → principais capitais
 * - "São Paulo" (estado) → cidades paulistas
 * - Qualquer outro país → descobre cidades via Places API automaticamente
 * - Cidade específica → retorna como está
 */
async function expandLocation(location: string): Promise<string[]> {
  const loc = location.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // ===== BRASIL =====
  if (loc === 'brasil' || loc === 'brazil' || loc === 'pais inteiro' || loc === 'todo pais' || loc === 'mundo') {
    return BRAZIL_STATES.map(s => s.name);
  }

  // Estado brasileiro
  const matchedState = BRAZIL_STATES.find(s =>
    loc === normalizeState(s.name) || loc === s.uf.toLowerCase()
  );
  if (matchedState) return matchedState.cities;

  // Match parcial de estado
  const partialState = BRAZIL_STATES.find(s => {
    const normName = normalizeState(s.name);
    return loc.startsWith(normName) || normName.startsWith(loc);
  });
  if (partialState) return partialState.cities;

  // ===== PAÍSES CONHECIDOS (hardcoded) =====
  for (const [key, cities] of Object.entries(KNOWN_COUNTRIES)) {
    if (loc === key || loc.includes(key)) {
      return cities;
    }
  }

  // ===== QUALQUER OUTRO PAÍS: descoberta automática via API =====
  // Se parece nome de país (singular, sem preposição)
  const isLikelyCountry = !loc.includes(' ') || loc.split(' ').length <= 3;
  if (isLikelyCountry) {
    const discovered = await discoverCitiesViaPlaces(location);
    if (discovered.length >= 3) {
      console.log(`[RUNNER] Descoberta automática: ${discovered.length} cidades em "${location}"`);
      return discovered;
    }
  }

  // Já é local específico — retorna como está
  return [location];
}

function placeToLead(r: PlacesApiResult): SearchLead {
  return {
    nome: r.nome, telefone: r.telefone, site: r.site || '',
    endereco: r.endereco, avaliacao: r.avaliacao,
    reviewCount: String(r.reviewCount || ''), categoria: r.categoria,
    placeUrl: r.placeUrl, horarios: '', cep: '', email: '',
    instagram: '', facebook: '', tiktok: '', linkedin: '', cnpj: '',
    isMobile: r.isMobile,
  };
}

function dedup(leads: SearchLead[]): SearchLead[] {
  const seen = new Set<string>();
  return leads.filter(l => {
    const key = l.nome.toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isJunk(nome: string): boolean {
  const n = nome.toLowerCase();
  if (n.length < 3) return true;
  if (/^(road|street|avenue|map|search|login|home|about|contact)/i.test(n)) return true;
  if (/^\d+$/.test(n)) return true;
  if (/\.(com|net|org|gov)\b/.test(n)) return true;
  return false;
}

export async function runExtraction(config: RunnerConfig): Promise<SearchLead[]> {
  const {
    keyword, location, targetLimit, isBroadRegion,
    existingLeadKeys, onProgress, onDone,
  } = config;

  const startTime = Date.now();
  let finalized = false;
  let citiesCompleted = 0;

  const notify = (msg: string) => {
    if (onProgress) onProgress([], 0, 0, msg);
  };

  const finalize = async (leads: SearchLead[], error?: string) => {
    if (finalized) return leads;
    finalized = true;
    if (onDone) {
      try {
        await onDone({
          leads, scanned: leads.length,
          citiesDone: citiesCompleted,
          totalTimeMs: Date.now() - startTime, error,
        });
      } catch (e: any) {
        console.error('[RUNNER] onDone error:', e?.message || e);
      }
    }
    return leads;
  };

  try {
    // ===== EXPANSÃO GLOBAL DE LOCALIZAÇÃO =====
    const locations = isBroadRegion ? await expandLocation(location) : [location];
    const totalLocations = locations.length;

    notify(`🔍 Buscando "${keyword}" em ${totalLocations > 1 ? `${totalLocations} locais` : location}...`);

    const allLeads: SearchLead[] = [];
    const existingNames = new Set(existingLeadKeys.map(k => k.split('|')[0].toLowerCase()));
    const seenLeads = new Set<string>(Array.from(existingNames));

    // Concorrência: max 4 locais simultâneos
    const CONCURRENCY = 4;
    const chunked: string[][] = [];
    for (let i = 0; i < locations.length; i += CONCURRENCY) {
      chunked.push(locations.slice(i, i + CONCURRENCY));
    }

    for (const chunk of chunked) {
      if (allLeads.length >= targetLimit) break;

      // Verifica cancelamento
      if (config.shouldCancel) {
        const cancelled = await config.shouldCancel();
        if (cancelled) {
          notify(`⏹️ Cancelado (${allLeads.length} leads)`);
          return await finalize(allLeads, 'Cancelado');
        }
      }

      const batchResults = await Promise.all(
        chunk.map(async (loc) => {
          try {
            const subTarget = Math.max(10, Math.ceil((targetLimit - allLeads.length) / chunk.length));
            const places = await extractFromGooglePlaces(keyword, loc, subTarget);

            let leads = places.map(placeToLead);
            leads = dedup(leads);
            leads = leads.filter(l => !isJunk(l.nome));
            leads = leads.filter(l => {
              const nomeKey = l.nome.toLowerCase().trim();
              if (seenLeads.has(nomeKey)) return false;
              seenLeads.add(nomeKey);
              return true;
            });

            return { loc, leads };
          } catch (err: any) {
            console.error(`[RUNNER] Erro em "${loc}":`, err?.message || err);
            return { loc, leads: [] as SearchLead[] };
          }
        })
      );

      for (const { loc, leads } of batchResults) {
        citiesCompleted++;
        allLeads.push(...leads);
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        notify(
          `📍 ${loc}: +${leads.length} | 📊 ${Math.min(allLeads.length, targetLimit)}/${targetLimit} | ` +
          `🏙️ ${citiesCompleted}/${totalLocations} | ⏱️ ${elapsed}s`
        );
        if (allLeads.length >= targetLimit) break;
      }
    }

    const finalLeads = allLeads.slice(0, targetLimit);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const withMobile = finalLeads.filter(l => l.isMobile).length;
    console.log(`[RUNNER] ${finalLeads.length} leads em ${elapsed}s (${totalLocations} locais, ${withMobile} WhatsApp)`);
    return await finalize(finalLeads);

  } catch (err: any) {
    console.error('[RUNNER] Erro fatal:', err);
    return await finalize([], err?.message || 'Erro na extração');
  }
}
