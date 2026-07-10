// Runner Turbo — Extração em paralelo com expansão de localização
// Suporta Brasil inteiro, estados, cidades — paraleliza tudo

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

// ========== ESTADOS BRASILEIROS ==========
const BRAZIL_STATES: { name: string; uf: string }[] = [
  { name: 'Acre', uf: 'AC' },
  { name: 'Alagoas', uf: 'AL' },
  { name: 'Amapá', uf: 'AP' },
  { name: 'Amazonas', uf: 'AM' },
  { name: 'Bahia', uf: 'BA' },
  { name: 'Ceará', uf: 'CE' },
  { name: 'Distrito Federal', uf: 'DF' },
  { name: 'Espírito Santo', uf: 'ES' },
  { name: 'Goiás', uf: 'GO' },
  { name: 'Maranhão', uf: 'MA' },
  { name: 'Mato Grosso', uf: 'MT' },
  { name: 'Mato Grosso do Sul', uf: 'MS' },
  { name: 'Minas Gerais', uf: 'MG' },
  { name: 'Pará', uf: 'PA' },
  { name: 'Paraíba', uf: 'PB' },
  { name: 'Paraná', uf: 'PR' },
  { name: 'Pernambuco', uf: 'PE' },
  { name: 'Piauí', uf: 'PI' },
  { name: 'Rio de Janeiro', uf: 'RJ' },
  { name: 'Rio Grande do Norte', uf: 'RN' },
  { name: 'Rio Grande do Sul', uf: 'RS' },
  { name: 'Rondônia', uf: 'RO' },
  { name: 'Roraima', uf: 'RR' },
  { name: 'Santa Catarina', uf: 'SC' },
  { name: 'São Paulo', uf: 'SP' },
  { name: 'Sergipe', uf: 'SE' },
  { name: 'Tocantins', uf: 'TO' },
];

// Capitais + principais cidades de cada estado (3-5 por estado)
const STATE_CITIES: Record<string, string[]> = {
  'AC': ['Rio Branco'],
  'AL': ['Maceió', 'Arapiraca'],
  'AM': ['Manaus', 'Parintins'],
  'AP': ['Macapá'],
  'BA': ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Ilhéus', 'Porto Seguro'],
  'CE': ['Fortaleza', 'Juazeiro do Norte', 'Sobral'],
  'DF': ['Brasília', 'Taguatinga', 'Ceilândia'],
  'ES': ['Vitória', 'Vila Velha', 'Cariacica', 'Serra'],
  'GO': ['Goiânia', 'Anápolis', 'Rio Verde'],
  'MA': ['São Luís', 'Imperatriz', 'Caxias'],
  'MG': ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Montes Claros'],
  'MS': ['Campo Grande', 'Dourados'],
  'MT': ['Cuiabá', 'Várzea Grande', 'Rondonópolis'],
  'PA': ['Belém', 'Santarém', 'Ananindeua', 'Marabá'],
  'PB': ['João Pessoa', 'Campina Grande'],
  'PE': ['Recife', 'Olinda', 'Caruaru', 'Petrolina'],
  'PI': ['Teresina', 'Parnaíba'],
  'PR': ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel'],
  'RJ': ['Rio de Janeiro', 'Niterói', 'Duque de Caxias', 'Nova Iguaçu', 'Campos dos Goytacazes'],
  'RN': ['Natal', 'Mossoró'],
  'RO': ['Porto Velho', 'Ji-Paraná'],
  'RR': ['Boa Vista'],
  'RS': ['Porto Alegre', 'Caxias do Sul', 'Pelotas', 'Santa Maria', 'Novo Hamburgo'],
  'SC': ['Florianópolis', 'Joinville', 'Blumenau', 'São José'],
  'SE': ['Aracaju', 'Nossa Senhora do Socorro'],
  'SP': ['São Paulo', 'Campinas', 'São Bernardo do Campo', 'Santo André', 'Ribeirão Preto'],
  'TO': ['Palmas', 'Araguaína'],
};

/** Retorna nome normalizado do estado pra comparação */
function normalizeState(name: string): string {
  const n = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return n.replace(/^estado\s+(d[eo]\s+)?/i, '').trim();
}

/**
 * Expande uma localização ampla em sub-localizações.
 * "Brasil" → 27 estados
 * "São Paulo" (estado) → principais cidades de SP
 * "Rio de Janeiro" → cidade ou estado? Tenta cidade primeiro
 */
function expandLocation(location: string): string[] {
  const loc = location.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Brasil → todos os estados
  if (loc === 'brasil' || loc === 'brazil' || loc === 'pais inteiro' || loc === 'todo pais') {
    return BRAZIL_STATES.map(s => s.name);
  }

  // Tenta match com estado (nome ou UF)
  const matchedState = BRAZIL_STATES.find(s =>
    loc === normalizeState(s.name) ||
    loc === s.uf.toLowerCase()
  );

  if (matchedState) {
    const cities = STATE_CITIES[matchedState.uf];
    if (cities && cities.length > 0) return cities;
    return [matchedState.name]; // fallback pro estado inteiro
  }

  // Tenta match parcial (ex: "sao paulo" pode ser estado ou cidade)
  const partialState = BRAZIL_STATES.find(s => {
    const normName = normalizeState(s.name);
    return loc.startsWith(normName) || normName.startsWith(loc);
  });

  if (partialState) {
    const cities = STATE_CITIES[partialState.uf];
    if (cities && cities.length > 0) return cities;
    return [partialState.name];
  }

  // Já é um local específico — retorna como está
  return [location];
}

/** Converte resultado da Places API para SearchLead */
function placeToLead(r: PlacesApiResult): SearchLead {
  return {
    nome: r.nome,
    telefone: r.telefone,
    site: r.site || '',
    endereco: r.endereco,
    avaliacao: r.avaliacao,
    reviewCount: String(r.reviewCount || ''),
    categoria: r.categoria,
    placeUrl: r.placeUrl,
    horarios: '', cep: '', email: '', instagram: '', facebook: '',
    tiktok: '', linkedin: '', cnpj: '',
    isMobile: r.isMobile,
  };
}

/** Remove duplicatas por nome */
function dedup(leads: SearchLead[]): SearchLead[] {
  const seen = new Set<string>();
  return leads.filter(l => {
    const key = l.nome.toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Remove leads óbvios que não são negócios */
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
    existingLeadKeys, onProgress, onDone, shouldCancel,
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
          leads,
          scanned: leads.length,
          citiesDone: citiesCompleted,
          totalTimeMs: Date.now() - startTime,
          error,
        });
      } catch (e: any) {
        console.error('[RUNNER] onDone error:', e?.message || e);
      }
    }
    return leads;
  };

  try {
    // ===== EXPANSÃO DE LOCALIZAÇÃO =====
    const locations = isBroadRegion ? expandLocation(location) : [location];
    const totalLocations = locations.length;

    notify(`Buscando "${keyword}" em ${totalLocations > 1 ? `${totalLocations} locais` : location}...`);

    // ===== EXECUÇÃO EM PARALELO =====
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
      if (shouldCancel) {
        const cancelled = await shouldCancel();
        if (cancelled) {
          notify(`⏹️ Extração cancelada (${allLeads.length} leads)`);
          return await finalize(allLeads, 'Cancelado pelo usuário');
        }
      }

      const batchResults = await Promise.all(
        chunk.map(async (loc) => {
          try {
            const subTarget = Math.max(10, Math.ceil((targetLimit - allLeads.length) / chunk.length));
            const places = await extractFromGooglePlaces(keyword, `${loc}`, subTarget);

            let leads = places.map(placeToLead);
            leads = dedup(leads);
            leads = leads.filter(l => !isJunk(l.nome));

            // Remove leads já existentes
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

      // Adiciona resultados do batch
      for (const { loc, leads } of batchResults) {
        citiesCompleted++;
        allLeads.push(...leads);

        const elapsed = Math.round((Date.now() - startTime) / 1000);
        notify(
          `📍 ${loc}: +${leads.length} leads | ` +
          `📊 ${Math.min(allLeads.length, targetLimit)}/${targetLimit} | ` +
          `🏙️ ${citiesCompleted}/${totalLocations} locais | ⏱️ ${elapsed}s`
        );

        if (allLeads.length >= targetLimit) break;
      }
    }

    // Limita ao solicitado
    const finalLeads = allLeads.slice(0, targetLimit);

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const withMobile = finalLeads.filter(l => l.isMobile).length;
    console.log(
      `[RUNNER] ${finalLeads.length} leads em ${elapsed}s ` +
      `(${totalLocations} locais, ${withMobile} com WhatsApp)`
    );

    return await finalize(finalLeads);

  } catch (err: any) {
    console.error('[RUNNER] Erro fatal:', err);
    return await finalize([], err?.message || 'Erro na extração');
  }
}
