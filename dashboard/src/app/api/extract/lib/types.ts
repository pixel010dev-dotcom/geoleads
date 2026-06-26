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
 * Detecta leads genéricos que NÃO são negócios reais (APENAS padrões óbvios):
 * - Páginas de listagem/diretório ("10 Melhores...", "Lista de...")
 * - URLs no nome (diretórios)
 * - Nomes de página genéricos sem contato
 *
 * Importante: ser conservador pra não bloquear leads legítimos.
 */
function isJunkResult(nome: string, telefone: string): boolean {
  const n = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Padrões óbvios de página de listagem/diretório
  const junkPatterns = [
    /^\d+\s+(melhore|melhor|top|melhores)(s\s+|e\s+)/i,
    /^(lista|guia|diretorio)\s+(d[eo]\s+|com\s+)/i,
    /(lista\s+(d[eo]|com)|guia\s+(d[eo]|com)|diretorio\s+)/i,
  ];
  for (const p of junkPatterns) {
    if (p.test(n)) return true;
  }

  // Nome contém URL (claramente um diretório, não negócio)
  if (/\.(com|com\.br|net|org)\b/.test(n)) return true;

  // Nome muito longo (>80) sem telefone → provável página de agregação
  if (n.length > 80 && (!telefone || telefone === 'Não informado')) {
    return true;
  }

  return false;
}

export function scoreLeadQuality(lead: SearchLead): { score: number; tier: ScoreQuality } {
  let score = 0;

  // Se for lixo óbvio detectado, já vai pra trash
  if (lead.nome && isJunkResult(lead.nome, lead.telefone)) {
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

  let tier: ScoreQuality;
  if (score >= 70) tier = 'high';
  else if (score >= 40) tier = 'medium';
  else if (score >= 10) tier = 'low';
  else tier = 'trash';

  return { score, tier };
}
