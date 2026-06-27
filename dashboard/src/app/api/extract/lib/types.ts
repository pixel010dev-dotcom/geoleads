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
  linkedin: string;
  cnpj: string;
  cidade?: string;
  hasWhatsApp?: boolean;
}

export function createEmptySearchLead(): SearchLead {
  return {
    nome: '', telefone: 'Não informado', site: 'Sem site', endereco: '',
    avaliacao: 'N/A', reviewCount: '', categoria: '', horarios: '', cep: '',
    placeUrl: '', email: '', instagram: '', facebook: '', tiktok: '', linkedin: '', cnpj: ''
  };
}

export interface MapsPlaceExtraData {
  telefone: string;
  site: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  linkedin: string;
  endereco: string;
  horarios: string;
}

export function emptyMapsPlaceExtraData(): MapsPlaceExtraData {
  return { telefone: '', site: '', instagram: '', facebook: '', tiktok: '', linkedin: '', endereco: '', horarios: '' };
}

export interface EnrichmentData {
  email: string;
  cnpj: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  linkedin: string;
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
 * Palavras genéricas do português que NUNCA são nomes de negócios reais
 * quando aparecem sozinhas ou como título de listagem ("Dentista", "Academia").
 * Usado para penalizar leads que são páginas de categoria, não negócios.
 */
const GENERIC_WORDS = new Set([
  // Profissões (singular + plural)
  'dentista', 'dentistas', 'advogado', 'advogados', 'medico', 'medicos',
  'médico', 'engenheiro', 'engenheiros', 'arquiteto', 'arquitetos',
  'contador', 'contadores', 'professor', 'professores', 'psicologo',
  'psicologos', 'psicólogo', 'fisioterapeuta', 'fisioterapeutas',
  'nutricionista', 'nutricionistas', 'cabeleireiro', 'cabeleireiros',
  'barbeiro', 'barbeiros', 'manicure', 'manicures', 'esteticista',
  'esteticistas', 'veterinario', 'veterinarios', 'veterinário',
  // Estabelecimentos genéricos
  'academia', 'academias', 'restaurante', 'restaurantes', 'pizzaria',
  'pizzarias', 'padaria', 'padarias', 'lanchonete', 'lanchonetes',
  'mercado', 'mercados', 'supermercado', 'supermercados', 'loja', 'lojas',
  'boutique', 'boutiques', 'clinica', 'clinicas', 'clínica', 'clínicas',
  'hospital', 'hospitais', 'escola', 'escolas', 'hotel', 'hoteis',
  'hotéis', 'pousada', 'pousadas', 'oficina', 'oficinas', 'borracharia',
  'borracharias', 'mecanica', 'mecanicas', 'mecânica', 'conveniencia',
  'barbearia', 'barbearias', 'salão', 'salão',
  // Palavras genéricas (contato, endereço, etc.)
  'contato', 'contatos', 'home', 'info', 'site', 'email', 'telefone',
  'whatsapp', 'endereco', 'endereço', 'negocio', 'negocios', 'negócio',
  'negócios', 'comercio', 'comercios', 'comércio', 'servico', 'servicos',
  'serviço', 'serviços', 'produto', 'produtos', 'artigo', 'artigos',
  'local', 'locais', 'lugar', 'lugares', 'geral',
]);

/**
 * Retorna penalidade de score baseada no quão genérico é o nome.
 * Quanto mais genérico (categoria, profissão, listagem), maior a penalidade.
 * Leads legítimos com nome específico ou com placeUrl não são penalizados.
 * placeUrl é a prova real: se o lead tem URL única do Maps, é negócio real.
 */
function getGenericNamePenalty(nome: string, categoria: string, placeUrl: string): number {
  // Se tem placeUrl, é negócio real do Maps — sem penalidade
  if (placeUrl) return 0;

  const n = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;

  // 1. Página de listagem: "Os 20 Dentistas mais recomendados"
  if (/^(os|as|o|a)\s+\d+/i.test(n)) return 35;

  // 2. Nome é APENAS um genérico
  //    Ex: "Dentista", "Academia", "Contato"
  if (words.length === 1) {
    if (GENERIC_WORDS.has(words[0])) return 35;
    return 0;
  }

  // 3. Nome = palavra genérica + localização (sem "em")
  //    Ex: "Dentista Belo Horizonte", "Academia Curitiba"
  const firstWord = words[0];
  if (GENERIC_WORDS.has(firstWord)) {
    const catNormalized = categoria.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const catFirstWord = catNormalized.split(/\s+/)[0];

    // Começa com a própria categoria + sem placeUrl = página de listagem
    if (firstWord === catFirstWord) return 35;

    // Nome curto começando com genérico + sem vinculo real com Maps
    if (words.length <= 4) return 25;
  }

  return 0;
}

/**
 * Remove sufixo " em [Cidade], [UF]" de nomes de negócios reais
 * que tiveram localização anexada pelo scraper.
 * Ex: "ACADEMIA FERNANDES em Rio de Janeiro, RJ" → "ACADEMIA FERNANDES"
 */
export function cleanLeadName(nome: string): string {
  return nome.replace(/\s+em\s+.+?(?:,\s*[A-Z]{2})?\s*$/i, '').trim();
}

/**
 * Detecta leads genéricos que NÃO são negócios reais:
 * - Páginas de listagem/diretório ("10 Melhores...", "Lista de...")
 * - URLs no nome (diretórios)
 * - Nomes de página genéricos sem contato
 * - Emoji/telefone no nome (resíduo de UI)
 * - "em" duplicado (categoria com local repetida)
 * - Uma única palavra genérica + "em" + local (página de categoria do Maps)
 */
function isJunkResult(nome: string, telefone: string): boolean {
  const n = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Uma única palavra genérica que NUNCA é nome de negócio
  if (/^(road|aerial|hybrid|satellite|terrain|street|roadmap|jswarning|\+n|sign\s*in|login|register|privacy|terms|search|home|about|contact|help|faq|blog|news|settings|account|profile|dashboard|menu|close|open|back|next|previous|submit|cancel|ok|yes|no|loading|error|warning|success|3d|2d|4k|hd|ai|vr|ar|ui|ux|saas|erp|crm|seo|api|sdk|faq|pdf|csv|xls)$/i.test(n)) return true;

  // Nome muito curto (1-2 chars) — nunca é negócio
  if (n.length <= 2) return true;

  // Nome começa com número — resíduo de UI
  if (/^\d/.test(n)) return true;

  // Programas corporativos conhecidos (não são negócios locais)
  if (/^(microsoft|google|amazon|apple|meta|netflix|uber|airbnb)\s/i.test(n)) return true;

  // Padrões de página de listagem/diretório
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
  if (n.length > 80 && (!telefone || telefone === 'Não informado')) return true;

  // Nome contém emoji de telefone (resíduo de UI do Maps)
  if (/[☎📞📱📲]/.test(nome)) return true;

  // Nome contém número de telefone com DDD (resíduo de UI)
  // Ex: "Academia (21) 3407-1234" — não é nome de negócio
  if (/\(\d{2,3}\)\s*\d{4,5}[- ]?\d{4}/.test(nome)) return true;

  // "em" aparece duas vezes (categoria com local duplicada)
  // Ex: "Academias em Rio de Janeiro, RJ em Rio de Janeiro, RJ"
  if (/\bem\b.*\bem\b/i.test(nome)) return true;

  // Página de busca/diretório: começa com verbo imperativo
  // Ex: "Encontre Dentistas", "Busque Advogados"
  if (/^(encontre|busque|procure|ache|localize|pesquise|descubra)\s/i.test(n)) return true;

  // Página de categoria do Google Maps: "SingleWord em Location"
  // Ex: "Academia em Rio", "Academias em SP", "Clinicas em São Paulo"
  // Uma única palavra genérica + "em" = título de listagem, não negócio
  // Não confundir com "ACADEMIA FERNANDES em RJ" (2 palavras = negócio real)
  if (/^([a-z]{2,})(?:\s+(?:de|da|do|das|dos))?\s+em\s+/i.test(n)) return true;

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
  if (lead.linkedin) score += 8;
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
    !!lead.linkedin,
  ].filter(Boolean).length;
  if (contactChannels >= 3) score += 10;
  else if (contactChannels >= 2) score += 5;

  // Penalidade para nomes genéricos sem placeUrl (páginas de categoria)
  score -= getGenericNamePenalty(lead.nome || '', lead.categoria || '', lead.placeUrl || '');

  let tier: ScoreQuality;
  if (score >= 70) tier = 'high';
  else if (score >= 40) tier = 'medium';
  else if (score >= 10) tier = 'low';
  else tier = 'trash';

  return { score, tier };
}
