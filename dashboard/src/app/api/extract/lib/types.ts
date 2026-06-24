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

export function scoreLeadQuality(lead: SearchLead): { score: number; tier: ScoreQuality } {
  let score = 0;
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
