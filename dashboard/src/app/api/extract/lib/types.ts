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

export interface MapsPlaceExtraData {
  telefone: string;
  site: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  endereco: string;
  horarios: string;
}

export function emptyMapsPlaceExtraData(): MapsPlaceExtraData {
  return { telefone: '', site: '', instagram: '', facebook: '', tiktok: '', endereco: '', horarios: '' };
}

export interface EnrichmentData {
  email: string;
  cnpj: string;
  instagram: string;
  facebook: string;
  tiktok: string;
}

export interface ExtractionJob {
  id: string;
  userId: string;
  keyword: string;
  location: string;
  correctedKeyword: string;
  correctedLocation: string;
  targetLimit: number;
  filterRule: string;
  isBroadRegion: boolean;
  existingLeadKeys: string[];
}

export interface ExtractionResult {
  leads: SearchLead[];
  scanned: number;
  citiesScanned: number;
  startTime: number;
  errors: string[];
}

export interface ExtractionStrategy {
  name: string;
  priority: number;
  extract(params: ExtractionStrategyParams): AsyncGenerator<SearchLead[], void, unknown>;
}

export interface ExtractionStrategyParams {
  keyword: string;
  location: string;
  targetLimit: number;
  existingKeys: Set<string>;
  signal?: AbortSignal;
  onProgress?: (leads: SearchLead[], scanned: number) => void;
}

export interface StrategyWeights {
  primary: string;
  fallbacks: string[];
  lastSuccess: { [strategy: string]: number };
}

export type ScoreQuality = 'high' | 'medium' | 'low' | 'trash';

/**
 * Detecta leads genéricos que não são negócios reais:
 * - Páginas de listagem/diretório ("10 Melhores...", "Lista de...")
 * - Páginas de busca ("Academias em Rio de Janeiro")
 * - Resultados que parecem categorias, não estabelecimentos
 */
function isJunkResult(nome: string, telefone: string, keyword?: string): boolean {
  const n = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Palavras que indicam página de listagem/diretório, não negócio real
  const junkPatterns = [
    /^\d+\s+(melhore|melhor|top|melhores|primeiro|primeira)/i,
    /^(lista|guia|diretorio|directorio|categoria|categorias|pagina)\s+(d[eo]|de\s+)/i,
    /(lista\s+d[eo]|guia\s+d[eo]|diretorio\s+d[eo]|relacao\s+d[eo])/i,
    /(telefone\s+d[eo]|email\s+d[eo]|endereco\s+d[eo])/i,
    /(os\s+melhores|as\s+melhores|melhores\s+[a-z]+\s+em)/i,
    /(tudo\s+sobre|tudo\s+de|tudo\s+em)/i,
    /^\d+\s*-\s*[a-z]/i,
  ];
  for (const p of junkPatterns) {
    if (p.test(n)) return true;
  }

  // Nome é muito genérico (só categoria + localização, sem nome real de negócio)
  if (keyword) {
    const kw = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const kwWords = kw.split(/\s+/).filter(w => w.length > 2);
    const nWithoutLocation = n
      .replace(/\s*[-–—,|]\s*(rj|sp|mg|rs|pr|sc|ba|pe|ce|go|df|es|pa|am|mt|ms|ma|pb|rn|se|al|to|ac|ap|ro|rr|brasil|brazil)/i, '')
      .replace(/\(\d{4}\)/, '')
      .replace(/\s*\/\s*(rj|sp|mg|rs|pr|sc)/i, '')
      .trim();

    // Se depois de limpar, só sobrou a keyword → é página de busca
    if (kwWords.length > 0) {
      const remainingWords = nWithoutLocation.split(/\s+/).filter(w => w.length > 2);
      const nonKwWords = remainingWords.filter(w => !kwWords.some(kw => w.includes(kw) || kw.includes(w)));
      if (nonKwWords.length === 0 && remainingWords.length > 0) {
        return true;
      }
    }

    // Nome contém keyword E localização (padrão de página de resultado)
    const locationWords = keyword.split(/\s+/).filter(w => w.length > 3);
    const matchCount = locationWords.filter(lw => n.includes(lw.toLowerCase())).length;
    if (matchCount >= locationWords.length && locationWords.length > 0) {
      // Se tem telefone real, pode ser um negócio válido
      if (!telefone || telefone === 'Não informado') {
        return true;
      }
    }
  }

  // Nome muito longo sem contato → provavelmente listagem
  if (n.length > 60 && (!telefone || telefone === 'Não informado')) {
    return true;
  }

  // Nome é um subdomínio de diretório (ex: "academias.em.rio.de.janeiro.tipo.com")
  if (/\.(com|com\.br|net|org)\b/.test(n)) return true;

  return false;
}

export function scoreLeadQuality(lead: SearchLead, keyword?: string): { score: number; tier: ScoreQuality } {
  let score = 0;

  // Se for lixo detectado, já vai pra trash
  if (lead.nome && isJunkResult(lead.nome, lead.telefone, keyword)) {
    return { score: 0, tier: 'trash' };
  }

  if (lead.nome) score += 15;
  if (lead.telefone && lead.telefone !== 'Não informado') score += 20;
  if (lead.site && lead.site !== 'Sem site') score += 15;
  if (lead.endereco) score += 10;
  if (lead.email) score += 15;
  if (lead.cnpj) score += 10;
  if (lead.instagram) score += 8;
  if (lead.facebook) score += 8;
  if (lead.tiktok) score += 8;
  if (lead.avaliacao !== 'N/A') score += 5;
  if (lead.placeUrl) score += 5;
  if (lead.categoria) score += 3;
  if (lead.horarios) score += 3;
  if (lead.cep) score += 3;

  // Bônus para leads com múltiplos canais de contato
  const contactChannels = [
    lead.telefone && lead.telefone !== 'Não informado',
    !!lead.email,
    !!lead.instagram,
    !!lead.facebook,
    !!lead.tiktok,
  ].filter(Boolean).length;
  if (contactChannels >= 3) score += 10;
  else if (contactChannels >= 2) score += 5;

  // Penalidade: nome que parece página (muito genérico sem contato)
  if (score < 20 && (!lead.telefone || lead.telefone === 'Não informado') && (!lead.site || lead.site === 'Sem site')) {
    score = Math.max(0, score - 15);
  }

  let tier: ScoreQuality;
  if (score >= 70) tier = 'high';
  else if (score >= 40) tier = 'medium';
  else if (score >= 10) tier = 'low';
  else tier = 'trash';

  return { score, tier };
}
