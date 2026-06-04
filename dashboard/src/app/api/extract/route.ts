import { NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { createRequestSupabaseClient, getAuthUser, requireFeature, createAdminSupabaseClient } from '@/lib/server-auth';
import { type FeatureKey } from '@/lib/plans';
import { reserveTokens, consumeReservation, refundReservation, saveExtractionResults, deliverExtractionResults } from '@/lib/billing';

export const runtime = 'nodejs';

// Controle de extrações simultâneas por usuário
const activeExtractions = new Map<string, number>();
const MAX_CONCURRENT_PER_USER = 2;
const MAX_GLOBAL_CONCURRENT = 10;

function getConcurrentExtractions(userId: string): number {
  return activeExtractions.get(userId) || 0;
}

function getGlobalConcurrent(): number {
  let total = 0;
  for (const count of activeExtractions.values()) total += count;
  return total;
}

// Algoritmo de Distância de Levenshtein para medir similaridade entre palavras
function getLevenshteinDistance(a: string, b: string): number {
  const tmp = [];
  let i, j, val;
  for (i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (i = 1; i <= a.length; i++) {
    for (j = 1; j <= b.length; j++) {
      val = (a[i - 1] === b[j - 1]) ? 0 : 1;
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1, // deletar
        tmp[i][j - 1] + 1, // inserir
        tmp[i - 1][j - 1] + val // substituir
      );
    }
  }
  return tmp[a.length][b.length];
}

// Nichos comerciais comuns no Brasil para busca difusa (Fuzzy Matching)
const COMMON_NICHES = [
  'advogado', 'dentista', 'academia', 'restaurante', 'pizzaria', 'hamburgueria',
  'sorveteria', 'confeitaria', 'cafeteria', 'estética', 'salão de beleza',
  'cabeleireiro', 'barbearia', 'imobiliária', 'contabilidade', 'petshop',
  'veterinária', 'oficina', 'borracharia', 'autopeças', 'médico',
  'psicólogo', 'nutricionista', 'fisioterapeuta', 'clínica', 'farmácia',
  'supermercado', 'padaria', 'açougue', 'hortifruti', 'escola', 'creche',
  'faculdade', 'hotel', 'pousada', 'motel', 'estúdio', 'crossfit',
  'arquiteto', 'engenheiro', 'construtora', 'marcenaria', 'vidraçaria',
  'serralheria', 'pintor', 'eletricista', 'encanador', 'gesso', 'limpeza',
  'lavanderia', 'floricultura', 'gráfica', 'papelaria', 'assistência técnica',
  'informática', 'celular', 'desentupidora', 'dedetizadora', 'segurança',
  'advocacia', 'odontologia', 'autoescola'
];

// Dicionário de Correções Rápidas (erros ortográficos diretos)
const TYPO_DICTIONARY: Record<string, string> = {
  'adivogado': 'advogado',
  'adevogado': 'advogado',
  'adivogacia': 'advocacia',
  'adevogacia': 'advocacia',
  'denticta': 'dentista',
  'dentixta': 'dentista',
  'restauranti': 'restaurante',
  'acadimia': 'academia',
  'iscola': 'escola',
  'cabelereiro': 'cabeleireiro',
  'cabelerero': 'cabeleireiro',
  'cabeleirero': 'cabeleireiro',
  'farmasia': 'farmácia',
  'ofissina': 'oficina',
  'boracharia': 'borracharia',
  'pisaria': 'pizzaria',
  'pissaria': 'pizzaria',
  'hamburguerria': 'hamburgueria',
  'sorveterria': 'sorveteria',
  'imobliaria': 'imobiliária',
  'imobiliara': 'imobiliária',
  'estetcia': 'estética',
  'esstetica': 'estética',
  'esteticista': 'esteticista',
  'comfeitaria': 'confeitaria',
  'contabelidade': 'contabilidade',
  'medco': 'médico'
};

// Dicionário de abreviações e shorthand de Cidades/Regiões
function normalizeAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function dictLookup(loc: string): string | undefined {
  return LOCATION_DICTIONARY[loc] || LOCATION_DICTIONARY[normalizeAccents(loc)];
}

function cleanLocation(raw: string): string {
  let loc = raw.trim().toLowerCase();
  if (!loc) return '';
  // 1. Remove artigos/preposições do início
  loc = loc.replace(/^(em|no|na|nos|nas|em todo|em toda|in|at|en|el|la|le|a|an)\s+/i, '').trim();
  // 2. Remove parênteses e conteúdo entre parênteses
  loc = loc.replace(/\(.*?\)/g, '').trim();
  // 3. Remove sufixo após vírgula (ex: "são paulo, sp" → "são paulo")
  loc = loc.replace(/,.*$/, '').trim();
  // 4. Remove sufixo após hífen com espaço (ex: "são paulo - sp" → "são paulo")
  loc = loc.replace(/\s*-\s*[a-z0-9\s]+$/i, '').trim();
  // 5. Se sobrou "sp" sozinho, mantém
  return loc;
}

const LOCATION_DICTIONARY: Record<string, string> = {
  'sp': 'São Paulo',
  'sao paulo': 'São Paulo',
  'sao paolo': 'São Paulo',
  's. paulo': 'São Paulo',
  'sãopaulo': 'São Paulo',
  'rj': 'Rio de Janeiro',
  'rio': 'Rio de Janeiro',
  'rio de janero': 'Rio de Janeiro',
  'bh': 'Belo Horizonte',
  'belo horizonte': 'Belo Horizonte',
  'bsb': 'Brasília',
  'brasilia': 'Brasília',
  'poa': 'Porto Alegre',
  'porto alegre': 'Porto Alegre',
  'floripa': 'Florianópolis',
  'florianopolis': 'Florianópolis',
  'curitba': 'Curitiba',
  'curitiba': 'Curitiba',
  'salvado': 'Salvador',
  'salvador': 'Salvador',
  'fortalesa': 'Fortaleza',
  'fortaleza': 'Fortaleza',
  'recfe': 'Recife',
  'recife': 'Recife',
  'goiana': 'Goiânia',
  'goiania': 'Goiânia',
  'manos': 'Manaus',
  'manaus': 'Manaus',
  'vitora': 'Vitória',
  'vitoria': 'Vitória',
  // Estados brasileiros
  'mg': 'Minas Gerais', 'ba': 'Bahia', 'pr': 'Paraná', 'rs': 'Rio Grande do Sul',
  'sc': 'Santa Catarina', 'go': 'Goiás', 'pe': 'Pernambuco', 'ce': 'Ceará',
  'pa': 'Pará', 'ma': 'Maranhão', 'pb': 'Paraíba', 'rn': 'Rio Grande do Norte',
  'al': 'Alagoas', 'pi': 'Piauí', 'se': 'Sergipe', 'ro': 'Rondônia',
  'to': 'Tocantins', 'ac': 'Acre', 'ap': 'Amapá', 'rr': 'Roraima',
  'ms': 'Mato Grosso do Sul', 'mt': 'Mato Grosso', 'es': 'Espírito Santo',
  'df': 'Distrito Federal',
  // Países
  'eua': 'Estados Unidos', 'usa': 'Estados Unidos', 'estados unidos': 'Estados Unidos',
  'eua (estados unidos)': 'Estados Unidos', 'estados unidos da américa': 'Estados Unidos',
  'espanha': 'Espanha', 'china': 'China', 'iraque': 'Iraque', 'italia': 'Itália',
  'itália': 'Itália', 'frança': 'França', 'franca': 'França', 'alemanha': 'Alemanha',
  'inglaterra': 'Inglaterra', 'reino unido': 'Reino Unido', 'portugal': 'Portugal',
  'argentina': 'Argentina', 'méxico': 'México', 'mexico': 'México',
  'canadá': 'Canadá', 'canada': 'Canadá', 'japão': 'Japão', 'japao': 'Japão',
  'austrália': 'Austrália', 'australia': 'Austrália',
  // US states (all 50) — códigos que colidem com BR foram sufixados com _us
  'ny': 'Nova York', 'nova york': 'Nova York', 'new york': 'Nova York',
  'california': 'Califórnia', 'califórnia': 'Califórnia',
  'florida': 'Flórida', 'flórida': 'Flórida',
  'ca': 'Califórnia', 'tx': 'Texas', 'fl': 'Flórida', 'il': 'Illinois',
  'oh': 'Ohio', 'ga': 'Geórgia', 'nc': 'Carolina do Norte',
  'mi': 'Michigan', 'nj': 'Nova Jersey', 'va': 'Virgínia', 'wa': 'Washington',
  'az': 'Arizona', 'tn': 'Tennessee', 'in': 'Indiana',
  'md': 'Maryland', 'mo': 'Missouri', 'wi': 'Wisconsin', 'co': 'Colorado',
  'mn': 'Minnesota', 'ky': 'Kentucky', 'or': 'Oregon', 'ok': 'Oklahoma',
  'ct': 'Connecticut', 'ut': 'Utah', 'ia': 'Iowa', 'nv': 'Nevada',
  'ar': 'Arkansas', 'ks': 'Kansas', 'nm': 'Novo México', 'ne': 'Nebraska',
  'wv': 'Virgínia Ocidental', 'id': 'Idaho', 'hi': 'Havaí', 'me': 'Maine',
  'nh': 'New Hampshire', 'ri': 'Rhode Island', 'de': 'Delaware',
  'sd': 'Dakota do Sul', 'nd': 'Dakota do Norte', 'ak': 'Alasca',
  'vt': 'Vermont', 'wy': 'Wyoming',
  // US states que colidem com BR (usar nome completo)
  'pensilvânia': 'Pensilvânia', 'pennsylvania': 'Pensilvânia',
  'carolina do sul': 'Carolina do Sul', 'south carolina': 'Carolina do Sul',
  'montana': 'Montana', 'mississippi': 'Mississippi',
  'alabama': 'Alabama', 'luisiana': 'Luisiana', 'louisiana': 'Luisiana',
  'massachusetts': 'Massachusetts',
  // US cities
  'miami': 'Miami', 'los angeles': 'Los Angeles', 'la': 'Los Angeles',
  'chicago': 'Chicago', 'orlando': 'Orlando',
  'washington': 'Washington', 'washington dc': 'Washington', 'dc': 'Washington',
  'boston': 'Boston', 'dallas': 'Dallas', 'houston': 'Houston',
  'seattle': 'Seattle', 'san francisco': 'San Francisco', 'sf': 'San Francisco',
  'las vegas': 'Las Vegas', 'vegas': 'Las Vegas',
  'san diego': 'San Diego', 'phoenix': 'Phoenix', 'denver': 'Denver',
  'atlanta': 'Atlanta', 'portland': 'Portland', 'nashville': 'Nashville',
  'nova orleans': 'Nova Orleans', 'new orleans': 'Nova Orleans',
  'philadelphia': 'Filadélfia', 'filadélfia': 'Filadélfia',
  'san jose': 'San José', 'austin': 'Austin', 'indianapolis': 'Indianápolis',
  'indianápolis': 'Indianápolis', 'minneapolis': 'Minneapolis',
  'miami beach': 'Miami Beach', 'tampa': 'Tampa',
  // Estados brasileiros (full names)
  'acre': 'Acre', 'alagoas': 'Alagoas', 'amapá': 'Amapá', 'amazonas': 'Amazonas',
  'bahia': 'Bahia', 'ceará': 'Ceará', 'espírito santo': 'Espírito Santo',
  'goiás': 'Goiás', 'maranhão': 'Maranhão', 'mato grosso': 'Mato Grosso',
  'mato grosso do sul': 'Mato Grosso do Sul', 'minas gerais': 'Minas Gerais',
  'pará': 'Pará', 'paraíba': 'Paraíba', 'paraná': 'Paraná',
  'pernambuco': 'Pernambuco', 'piauí': 'Piauí', 'rio de janeiro': 'Rio de Janeiro',
  'rio grande do norte': 'Rio Grande do Norte', 'rio grande do sul': 'Rio Grande do Sul',
  'rondônia': 'Rondônia', 'roraima': 'Roraima', 'santa catarina': 'Santa Catarina',
  'são paulo': 'São Paulo', 'sergipe': 'Sergipe', 'tocantins': 'Tocantins',
  'distrito federal': 'Distrito Federal',
  // Mais cidades brasileiras
  'niterói': 'Niterói', 'niteroi': 'Niterói', 'duque de caxias': 'Duque de Caxias',
  'nova iguaçu': 'Nova Iguaçu', 'campos': 'Campos dos Goytacazes',
  'são gonçalo': 'São Gonçalo', 'são bernardo do campo': 'São Bernardo do Campo',
  'santo andré': 'Santo André', 'são josé dos campos': 'São José dos Campos',
  'sorocaba': 'Sorocaba', 'ribeirão preto': 'Ribeirão Preto',
  'uberlândia': 'Uberlândia', 'uberlandia': 'Uberlândia',
  'cuiabá': 'Cuiabá', 'cuiaba': 'Cuiabá', 'campo grande': 'Campo Grande',
  'joinville': 'Joinville', 'blumenau': 'Blumenau', 'londrina': 'Londrina',
  'maringá': 'Maringá', 'mariga': 'Maringá', 'juiz de fora': 'Juiz de Fora',
  'aracaju': 'Aracaju', 'maceió': 'Maceió', 'maceio': 'Maceió',
  'teresina': 'Teresina', 'palmas': 'Palmas', 'rio branco': 'Rio Branco',
  'porto velho': 'Porto Velho', 'boa vista': 'Boa Vista', 'macapá': 'Macapá',
  'macapa': 'Macapá', 'belém': 'Belém', 'belem': 'Belém',
  'ilhéus': 'Ilhéus', 'ilheus': 'Ilhéus', 'porto seguro': 'Porto Seguro',
  // Mais países
  'angola': 'Angola', 'argélia': 'Argélia', 'áfrica do sul': 'África do Sul',
  'belgica': 'Bélgica', 'bélgica': 'Bélgica', 'bolívia': 'Bolívia', 'bolivia': 'Bolívia',
  'chile': 'Chile', 'colômbia': 'Colômbia', 'colombia': 'Colômbia',
  'coreia': 'Coreia do Sul', 'coréia': 'Coreia do Sul', 'coreia do sul': 'Coreia do Sul',
  'costa rica': 'Costa Rica', 'cuba': 'Cuba', 'dinamarca': 'Dinamarca',
  'egito': 'Egito', 'equador': 'Equador', 'emirados árabes': 'Emirados Árabes Unidos',
  'escócia': 'Escócia', 'eslováquia': 'Eslováquia', 'eslovênia': 'Eslovênia',
  'finlândia': 'Finlândia', 'grécia': 'Grécia', 'holanda': 'Holanda',
  'hungria': 'Hungria', 'índia': 'Índia', 'indonésia': 'Indonésia',
  'irlanda': 'Irlanda', 'israel': 'Israel', 'marrocos': 'Marrocos',
  'noruega': 'Noruega', 'nova zelândia': 'Nova Zelândia', 'nova zelandia': 'Nova Zelândia',
  'países baixos': 'Países Baixos', 'polônia': 'Polônia', 'polonia': 'Polônia',
  'república tcheca': 'República Tcheca', 'romênia': 'Romênia', 'rússia': 'Rússia',
  'russia': 'Rússia', 'suécia': 'Suécia', 'suica': 'Suíça', 'suíça': 'Suíça',
  'tailândia': 'Tailândia', 'tailandia': 'Tailândia', 'turquia': 'Turquia', 'ucrânia': 'Ucrânia', 'uruguai': 'Uruguai',
  'venezuela': 'Venezuela',
  // Cidades internacionais
  'paris': 'Paris', 'londres': 'Londres', 'berlim': 'Berlim',
  'madri': 'Madri', 'madrid': 'Madri', 'barcelona': 'Barcelona',
  'roma': 'Roma', 'milão': 'Milão', 'milao': 'Milão', 'veneza': 'Veneza',
  'lisboa': 'Lisboa', 'lisbon': 'Lisboa', 'porto': 'Porto',
  'tóquio': 'Tóquio', 'toquio': 'Tóquio', 'tokyo': 'Tóquio',
  'xangai': 'Xangai', 'shanghai': 'Xangai', 'hong kong': 'Hong Kong',
  'bangkok': 'Bangkok', 'sydney': 'Sydney', 'melbourne': 'Melbourne',
  'dubai': 'Dubai', 'cidade do méxico': 'Cidade do México',
  'buenos aires': 'Buenos Aires', 'santiago': 'Santiago',
  'lima': 'Lima', 'bogotá': 'Bogotá', 'bogota': 'Bogotá',
  'montevidéu': 'Montevidéu', 'montevideu': 'Montevidéu',
  'assunção': 'Assunção', 'assuncao': 'Assunção',
  'cidade do panamá': 'Cidade do Panamá', 'san josé': 'San José',
  'havana': 'Havana', 'cancún': 'Cancún', 'cancun': 'Cancún',
  'punta cana': 'Punta Cana', 'santo domingo': 'Santo Domingo',
  'ontario': 'Ontário', 'toronto': 'Toronto', 'vancouver': 'Vancouver',
  'montreal': 'Montreal', 'ottawa': 'Ottawa',
  // Genéricos mundo
  'mundo': 'Brasil', 'mundo inteiro': 'Brasil', 'mundo todo': 'Brasil',
  'internacional': 'Brasil', 'global': 'Brasil',
};

// Regiões amplas — quando detectadas, busca sem localização específica
function isBroadLocation(location: string): boolean {
  const loc = location.trim().toLowerCase();
  if (!loc) return false;
  // Qualquer variação de "brasil" na localização ativa busca nacional
  if (/\bbrasil\b|\bbrazil\b/.test(loc)) return true;
  const exact = ['todos os estados', 'nacional', 'país inteiro', 'todo país', 'pais inteiro', 'todo estado'];
  if (exact.includes(loc)) return true;
  return false;
}

const LOCATION_LOWER_WORDS = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na']);

function smartNormalizeQuery(keyword: string, location: string) {
  let cleanKw = keyword.trim().toLowerCase();
  let cleanLoc = cleanLocation(location);

  // Tenta lookup com e sem acentos
  let dictResult = dictLookup(cleanLoc);
  if (!dictResult && cleanLoc.length >= 2) {
    // Se ainda tem sufixo de estado (2-3 letras), tenta sem ele
    const semSufixo = cleanLoc.replace(/\s+[a-z]{2,3}$/i, '').trim();
    if (semSufixo !== cleanLoc) dictResult = dictLookup(semSufixo);
  }
  cleanLoc = dictResult || cleanLoc;

  if (!dictResult) {
    cleanLoc = cleanLoc
      .split(/\s+/)
      .map(word => LOCATION_LOWER_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Normalização do Nicho (Keyword)
  // Dividimos em palavras para ver se alguma delas é um erro comum mapeado
  const words = cleanKw.split(/\s+/);
  const correctedWords = words.map(word => {
    // a. Se está no dicionário direto, corrige
    if (TYPO_DICTIONARY[word]) {
      return TYPO_DICTIONARY[word];
    }

    // b. Se não está, busca difusa (Levenshtein) contra a lista de nichos comuns
    let bestMatch = word;
    let minDistance = 999;
    
    // Só aplica para palavras com tamanho razoável (>= 4 letras)
    if (word.length >= 4) {
      for (const niche of COMMON_NICHES) {
        const dist = getLevenshteinDistance(word, niche);
        if (dist < minDistance) {
          minDistance = dist;
          bestMatch = niche;
        }
      }
      
      // Se a distância for muito pequena (1 ou 2 letras), aceita a correção
      if (minDistance <= 2) {
        return bestMatch;
      }
    }

    return word;
  });

  cleanKw = correctedWords.join(' ');
  
  // Capitaliza a keyword para ficar bonita na exibição e na busca
  cleanKw = cleanKw
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return {
    originalKeyword: keyword,
    originalLocation: location,
    correctedKeyword: cleanKw,
    correctedLocation: cleanLoc
  };
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BAD_EMAIL_REGEX = /sentry|wix|example|schema|wordpress|localhost|yourdomain|domain\.com|noreply|no-reply/i;
const CNPJ_REGEX = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/;
const HREF_REGEX = /href=["']([^"']+)["']/gi;
const ABSOLUTE_SOCIAL_REGEX = /https?:\/\/(?:www\.)?(?:instagram\.com|facebook\.com|fb\.com|tiktok\.com)\/[^\s"'<>]+/gi;

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return raw;
  // Rejeita números com 6+ dígitos repetidos consecutivos (falsos positivos do Maps)
  if (/(\d)\1{5,}/.test(digits)) return 'Não informado';
  // Se já tem DDI (+55), mantém
  if (digits.startsWith('55') && digits.length >= 12) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  }
  // Se tem DDI diferente
  if (digits.length >= 13 && !digits.startsWith('55')) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  }
  // Só DDD + número — verifica se é DDD brasileiro válido
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
    // DDD não brasileiro — formata como número internacional genérico
    return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
  }
  // Fallback: formato não reconhecido → marca como não disponível
  return 'Não informado';
}

function normalizeCnpj(value: string) {
  return value.replace(/\D/g, '').slice(0, 14);
}

function validateCnpjChecksum(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '').slice(0, 14);
  if (digits.length !== 14) return false;
  // Rejeita sequências iguais (11.111.111/1111-11)
  if (/^(\d)\1{13}$/.test(digits)) return false;
  // Valida 1º dígito verificador
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * (i < 4 ? 5 - i : 13 - i);
  let digit1 = 11 - (sum % 11);
  if (digit1 >= 10) digit1 = 0;
  if (parseInt(digits[12]) !== digit1) return false;
  // Valida 2º dígito verificador
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * (i < 5 ? 6 - i : 13 - i);
  let digit2 = 11 - (sum % 11);
  if (digit2 >= 10) digit2 = 0;
  return parseInt(digits[13]) === digit2;
}

function formatCnpj(value: string) {
  const digits = normalizeCnpj(value);
  if (digits.length !== 14) return '';
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function safeUrl(rawUrl: string, baseUrl: string) {
  try {
    if (!rawUrl || /^(mailto:|tel:|javascript:|#)/i.test(rawUrl)) return '';
    const url = new URL(rawUrl, baseUrl);
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

type MapsPlaceExtraData = {
  telefone: string;
  site: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  endereco: string;
  horarios: string;
};

function emptyMapsPlaceExtraData(): MapsPlaceExtraData {
  return { telefone: '', site: '', instagram: '', facebook: '', tiktok: '', endereco: '', horarios: '' };
}

function mergeMapsPlaceExtraData(target: MapsPlaceExtraData, source: Partial<MapsPlaceExtraData>) {
  if (!target.telefone && source.telefone) target.telefone = source.telefone;
  if (!target.site && source.site) target.site = source.site;
  if (!target.instagram && source.instagram) target.instagram = source.instagram;
  if (!target.facebook && source.facebook) target.facebook = source.facebook;
  if (!target.tiktok && source.tiktok) target.tiktok = source.tiktok;
  if (!target.endereco && source.endereco) target.endereco = source.endereco;
  if (!target.horarios && source.horarios) target.horarios = source.horarios;
}

function withMapsLocale(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (url.hostname.includes('google.')) {
      url.searchParams.set('hl', 'pt-BR');
      url.searchParams.set('gl', 'br');
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function decodeMapsPayloadText(raw: string) {
  let text = raw
    .replace(/\\u003d/g, '=')
    .replace(/\\u0026/g, '&')
    .replace(/\\u002f/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&');

  for (let i = 0; i < 2; i++) {
    try {
      const decoded = decodeURIComponent(text);
      if (decoded === text) break;
      text = decoded;
    } catch {
      break;
    }
  }

  return text;
}

function isValidBrazilianPhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  const local = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length < 10 || local.length > 11) return false;
  // Rejeita números com todos dígitos iguais (ex: 416666666666)
  if (/^(\d)\1+$/.test(local)) return false;
  // Rejeita números com 6+ dígitos consecutivos repetidos (ex: 416666666666 → '666666')
  if (/(\d)\1{5,}/.test(local)) return false;

  const ddd = parseInt(local.slice(0, 2), 10);
  return (ddd >= 11 && ddd <= 19) || (ddd >= 21 && ddd <= 28) ||
    (ddd >= 31 && ddd <= 38) || (ddd >= 41 && ddd <= 49) ||
    (ddd >= 51 && ddd <= 59) || (ddd >= 61 && ddd <= 69) ||
    (ddd >= 71 && ddd <= 79) || (ddd >= 81 && ddd <= 89) ||
    (ddd >= 91 && ddd <= 99);
}

function cleanMapsUrlCandidate(rawUrl: string) {
  let candidate = decodeMapsPayloadText(rawUrl)
    .replace(/^[\["']+/, '')
    .replace(/[\]"'<>\\]+$/g, '')
    .replace(/[),.;]+$/g, '');

  try {
    const url = new URL(candidate);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host.endsWith('google.com') && url.pathname === '/url') {
      const redirected = url.searchParams.get('q') || url.searchParams.get('url');
      if (redirected) candidate = redirected;
    }
  } catch {}

  return candidate;
}

function isGoogleOwnedHost(host: string): boolean {
  return host.includes('google.') || host.includes('googleapis.') || host.includes('gstatic.') ||
    host.includes('googleusercontent.') || host.includes('ggpht.') || host.includes('googlevideo.') ||
    host.includes('withgoogle.') || host.includes('schema.org') || host.includes('w3.org');
}

function isBusinessWebsiteCandidate(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (!/^https?:$/.test(url.protocol)) return false;
    if (isGoogleOwnedHost(host)) return false;
    if (host.includes('youtube.') || host.includes('youtu.be') || host.includes('maps.app.goo.gl')) return false;
    if (host.includes('instagram.com') || host.includes('facebook.com') || host.includes('fb.com')) return false;
    if (host.includes('tiktok.com') || host.includes('whatsapp.com') || host.includes('wa.me')) return false;
    return true;
  } catch {
    return false;
  }
}

function pickWebsiteFromMapsText(text: string) {
  const urls = text.match(/https?:\/\/[^\s"'<>\\\])]+/gi) || [];
  for (const rawUrl of urls) {
    const candidate = cleanMapsUrlCandidate(rawUrl);
    if (isBusinessWebsiteCandidate(candidate)) return candidate;
  }
  return '';
}

function extractMapsPlaceDataFromText(raw: string): MapsPlaceExtraData {
  const result = emptyMapsPlaceExtraData();
  const decoded = decodeMapsPayloadText(raw);

  // IMPORTANTE: NÃO extrai telefone de raw text/XHR response.
  // As respostas internas do Google Maps contêm números falsos (de assets, coordenadas, etc.)
  // que passam na validação de telefone brasileiro. Telefone só vem do DOM visível.
  // Site: só aceita se passar no filtro de negócio (não Google, não rede social)
  const siteFromText = pickWebsiteFromMapsText(decoded);
  if (siteFromText && isBusinessWebsiteCandidate(siteFromText)) {
    result.site = siteFromText;
  }

  // Redes sociais
  for (const match of decoded.matchAll(ABSOLUTE_SOCIAL_REGEX)) {
    const url = cleanMapsUrlCandidate(match[0]);
    if (url.includes('instagram.com') && !result.instagram) result.instagram = url;
    if ((url.includes('facebook.com') || url.includes('fb.com')) && !result.facebook) result.facebook = url;
    if (url.includes('tiktok.com') && !result.tiktok) result.tiktok = url;
  }

  return result;
}

function isMapsDetailsResponse(url: string) {
  const lower = url.toLowerCase();
  return (lower.includes('google.com/search?') && lower.includes('tbm=map')) ||
    lower.includes('/maps/preview/') ||
    lower.includes('/maps/rpc') ||
    lower.includes('/maps/place/');
}

async function waitForMapsPlaceContent(tab: any) {
  try {
    await tab.waitForFunction(() => {
      const text = document.body?.innerText || '';
      if (!text || text.length < 120) return false;
      if (/captcha|unusual traffic|trafego incomum|sorry/i.test(text)) return true;
      if (/\(?\d{2}\)?\s?\d{4,5}[\s-]?\d{4}/.test(text)) return true;
      if (document.querySelector('[data-item-id*="phone"], [data-item-id*="authority"], [data-item-id*="address"], a[href^="tel:"]')) return true;
      return text.includes('Sugerir mudança') || text.includes('Suggest an edit') || text.includes('Adicionar website');
    }, null, { timeout: 6500 });
  } catch {
    try { await tab.waitForTimeout(1500); } catch {}
  }
}

async function extractMapsPlaceDomData(tab: any): Promise<MapsPlaceExtraData> {
  return tab.evaluate(() => {
    const result: any = { telefone: '', site: '', instagram: '', facebook: '', tiktok: '', endereco: '', horarios: '' };
    const text = document.body?.innerText || '';
    const html = document.body?.innerHTML || '';

    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || '{}');
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item.telephone && !result.telefone) result.telefone = item.telephone;
          if (item.url && !result.site && !item.url.includes('google.com')) result.site = item.url;
          if (item.sameAs && Array.isArray(item.sameAs)) {
            for (const url of item.sameAs) {
              if (url.includes('instagram.com') && !result.instagram) result.instagram = url;
              if ((url.includes('facebook.com') || url.includes('fb.com')) && !result.facebook) result.facebook = url;
              if (url.includes('tiktok.com') && !result.tiktok) result.tiktok = url;
            }
          }
          if (item.address?.streetAddress && !result.endereco) {
            result.endereco = item.address.streetAddress;
            if (item.address.addressLocality) result.endereco += ', ' + item.address.addressLocality;
            if (item.address.addressRegion) result.endereco += ' - ' + item.address.addressRegion;
            if (item.address.postalCode) result.endereco += ', ' + item.address.postalCode;
          }
        }
      } catch {}
    }

    if (!result.telefone) {
      const phoneSel = [
        'button[data-item-id*="phone"]', 'a[data-item-id*="phone"]', 'a[href^="tel:"]',
        '[data-phone-number]', 'button[aria-label*="telefone"]', 'button[aria-label*="phone"]',
        '[data-tooltip*="telefone"]', '[data-tooltip*="phone"]', 'button[aria-label*="Ligar"]',
      ];
      for (const sel of phoneSel) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const v = el.getAttribute('aria-label') || el.getAttribute('data-phone-number') ||
                  el.getAttribute('href')?.replace('tel:', '') || el.getAttribute('data-value') ||
                  el.getAttribute('data-item-id') || (el as HTMLElement).innerText;
        if (v) { const m = v.match(/(\+?\d[\d\s\-\(\)]{8,18}\d)/); if (m) { result.telefone = m[1].trim(); break; } }
      }
    }
    if (!result.telefone) {
      for (const pat of [/(\+55\s?)?\(?\d{2}\)?\s?\d{4,5}[\s-]?\d{4}/g, /\+?\d{2}[\s-]?\d{2}[\s-]?\d{4,5}[\s-]?\d{4}/g, /\(?\d{2,3}\)?\s?\d{4,5}[\s-]?\d{4}/g]) {
        const ms = text.match(pat);
        if (ms && ms.length > 0) { result.telefone = ms[0].trim(); break; }
      }
    }

    if (!result.site) {
      const siteSel = [
        'a[data-item-id*="authority"]',
        'a[aria-label*="Website"]',
        'a[aria-label*="site"]',
        'a[data-tooltip*="Website"]',
        'a[data-tooltip*="site"]',
        'a[href^="http"]:not([href*="google"]):not([href*="maps"])'
      ];
      for (const sel of siteSel) {
        const siteEl = document.querySelector(sel);
        const h = siteEl?.getAttribute('href') || '';
        if (h && !h.includes('google.com') && !h.includes('/maps/')) { result.site = h; break; }
      }
    }

    if (!result.instagram && !result.facebook && !result.tiktok) {
      for (const m of html.matchAll(/https?:\/\/(?:www\.)?(instagram\.com|facebook\.com|fb\.com|tiktok\.com)\/[^\s"'<>]+/gi)) {
        const url = m[0].replace(/["'<>].*$/, '');
        if (url.includes('instagram.com') && !result.instagram) result.instagram = url;
        if ((url.includes('facebook.com') || url.includes('fb.com')) && !result.facebook) result.facebook = url;
        if (url.includes('tiktok.com') && !result.tiktok) result.tiktok = url;
      }
    }

    if (!result.endereco) {
      const addrEl = document.querySelector('[data-item-id*="address"]');
      if (addrEl) result.endereco = (addrEl as HTMLElement).innerText?.trim() || '';
    }

    const hMatch = text.match(/(Aberto|Fechado)(?:\s*·\s*)(.+?)(?:\.|$)/i);
    if (hMatch) result.horarios = hMatch[0].trim();

    return result;
  });
}

async function extractMapsPlaceDetails(tab: any, placeUrl: string): Promise<MapsPlaceExtraData> {
  const result = emptyMapsPlaceExtraData();
  const pendingResponses: Promise<void>[] = [];

  const onResponse = (response: any) => {
    if (!isMapsDetailsResponse(response.url())) return;

    const pending = (async () => {
      try {
        const headers = response.headers();
        const contentType = headers['content-type'] || '';
        const contentLength = Number(headers['content-length'] || '0');
        if (contentLength > 3000000) return;
        if (contentType && !/(json|text|html|javascript)/i.test(contentType)) return;
        const extra = extractMapsPlaceDataFromText(await response.text());
        mergeMapsPlaceExtraData(result, extra);
      } catch {}
    })();

    pendingResponses.push(pending);
  };

  tab.on('response', onResponse);

  try {
    try {
      await tab.goto(withMapsLocale(placeUrl), {
        waitUntil: 'domcontentloaded',
        timeout: 8000,
        referer: 'https://www.google.com/maps'
      });
    } catch {
      // Google Maps can keep navigation pending while the side panel is already usable.
    }

    await waitForMapsPlaceContent(tab);

    await Promise.race([
      Promise.allSettled(pendingResponses.slice(-10)),
      tab.waitForTimeout(1500)
    ]).catch(() => {});

    mergeMapsPlaceExtraData(result, await extractMapsPlaceDomData(tab).catch(() => emptyMapsPlaceExtraData()));

    if (!result.telefone && !result.site) {
      await tab.waitForTimeout(1000).catch(() => {});
      mergeMapsPlaceExtraData(result, await extractMapsPlaceDomData(tab).catch(() => emptyMapsPlaceExtraData()));
    }
  } finally {
    tab.off('response', onResponse);
  }

  return result;
}

function leadNeedsMapsPlaceDetails(lead: any) {
  return !!lead.placeUrl && (lead.telefone === 'Não informado' || !lead.site || lead.site === 'Sem site');
}

function applyMapsPlaceExtraDataToLead(lead: any, extraData: MapsPlaceExtraData) {
  let changed = false;

  if (extraData.telefone && isValidBrazilianPhone(extraData.telefone) && lead.telefone === 'Não informado') {
    lead.telefone = normalizePhone(extraData.telefone);
    changed = true;
  }

  if (extraData.site) {
    const contactUrl = extraData.site;
    if (contactUrl.includes('instagram.com') && !lead.instagram) {
      lead.instagram = contactUrl;
      changed = true;
    }
    if ((contactUrl.includes('facebook.com') || contactUrl.includes('fb.com')) && !lead.facebook) {
      lead.facebook = contactUrl;
      changed = true;
    }
    if (contactUrl.includes('tiktok.com') && !lead.tiktok) {
      lead.tiktok = contactUrl;
      changed = true;
    }
    if ((contactUrl.includes('wa.me') || contactUrl.includes('whatsapp.com')) && lead.telefone === 'Não informado') {
      const phoneMatch = contactUrl.match(/\d{10,15}/);
      if (phoneMatch && isValidBrazilianPhone(phoneMatch[0])) {
        lead.telefone = normalizePhone(phoneMatch[0]);
        changed = true;
      }
    }
  }

  if (extraData.site && isBusinessWebsiteCandidate(extraData.site) && (!lead.site || lead.site === 'Sem site')) {
    lead.site = extraData.site;
    changed = true;
  }
  if (extraData.instagram && !lead.instagram) {
    lead.instagram = extraData.instagram;
    changed = true;
  }
  if (extraData.facebook && !lead.facebook) {
    lead.facebook = extraData.facebook;
    changed = true;
  }
  if (extraData.tiktok && !lead.tiktok) {
    lead.tiktok = extraData.tiktok;
    changed = true;
  }
  if (extraData.endereco && !lead.endereco) {
    lead.endereco = extraData.endereco;
    changed = true;
  }
  if (extraData.horarios && !lead.horarios) {
    lead.horarios = extraData.horarios;
    changed = true;
  }

  return changed;
}

async function enrichLeadWithMapsPlaceDetails(context: any, lead: any) {
  if (!leadNeedsMapsPlaceDetails(lead)) return false;

  let tab: any = null;
  try {
    tab = await context.newPage();
    const extraData = await extractMapsPlaceDetails(tab, lead.placeUrl);
    return applyMapsPlaceExtraDataToLead(lead, extraData);
  } catch {
    return false;
  } finally {
    if (tab) try { await tab.close(); } catch {}
  }
}

async function enrichLeadsWithMapsPlaceDetails(
  context: any,
  leads: any[],
  shouldStop: () => Promise<boolean>,
  batchSize = 2
) {
  const candidates = leads.filter(leadNeedsMapsPlaceDetails);
  let changed = 0;

  for (let i = 0; i < candidates.length; i += batchSize) {
    if (await shouldStop()) break;
    const batch = candidates.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(lead => enrichLeadWithMapsPlaceDetails(context, lead)));
    changed += results.filter(Boolean).length;
  }

  return changed;
}

function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const hostname = u.hostname.toLowerCase();
    // Bloqueia IPs privados / internos (SSRF protection)
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' ||
        hostname === '[::1]' || hostname.endsWith('.local') || hostname.endsWith('.internal')) return false;
    // Bloqueia IPs privados 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 169.254.x.x
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
    if (ipv4) {
      const a = parseInt(ipv4[1]), b = parseInt(ipv4[2]);
      if (a === 10) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
      if (a === 169 && b === 254) return false;
      if (a === 127) return false;
    }
    return true;
  } catch { return false; }
}

async function fetchHtml(url: string) {
  if (!isSafeUrl(url)) return '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      redirect: 'follow',
    });

    if (!res.ok) return '';
    const contentType = res.headers.get('content-type') || '';
    if (contentType && !contentType.includes('text/html')) return '';
    return await res.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

function pickEmail(html: string) {
  const matches = Array.from(html.matchAll(EMAIL_REGEX), match => match[0]);
  return matches.find(email => !BAD_EMAIL_REGEX.test(email)) || '';
}

function pickCnpj(html: string) {
  const match = html.match(CNPJ_REGEX);
  if (!match) return '';
  const formatted = formatCnpj(match[0]);
  return validateCnpjChecksum(formatted) ? formatted : '';
}

function normalizeSocialUrl(rawUrl: string, baseUrl: string) {
  const fullUrl = safeUrl(rawUrl, baseUrl);
  if (!fullUrl) return null;

  try {
    const url = new URL(fullUrl);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    const path = url.pathname.replace(/\/+$/, '');

    if (host === 'instagram.com') {
      const blocked = /^\/(p|reel|reels|stories|explore|accounts|privacy|terms)\b/i.test(path);
      if (!blocked && /^\/[a-zA-Z0-9._]+$/.test(path)) return { key: 'instagram', url: `https://instagram.com${path}` };
    }

    if (host === 'facebook.com' || host === 'fb.com') {
      const blocked = /^\/(sharer|share|dialog|plugins|events|groups|login|privacy|help)\b/i.test(path);
      if (!blocked && path.length > 1) {
        const profileId = path === '/profile.php' ? url.searchParams.get('id') : '';
        const query = profileId ? `?id=${profileId}` : '';
        return { key: 'facebook', url: `https://facebook.com${path}${query}` };
      }
    }

    if (host === 'tiktok.com') {
      if (/^\/@[a-zA-Z0-9._]+$/.test(path)) return { key: 'tiktok', url: `https://www.tiktok.com${path}` };
    }
  } catch {
    return null;
  }

  return null;
}

function pickSocialLinks(html: string, baseUrl: string) {
  const socials: Record<'instagram' | 'facebook' | 'tiktok', string> = {
    instagram: '',
    facebook: '',
    tiktok: ''
  };
  const candidates = new Set<string>();
  let match: RegExpExecArray | null;

  HREF_REGEX.lastIndex = 0;
  while ((match = HREF_REGEX.exec(html))) candidates.add(match[1]);
  for (const socialMatch of html.matchAll(ABSOLUTE_SOCIAL_REGEX)) candidates.add(socialMatch[0]);

  for (const candidate of candidates) {
    const social = normalizeSocialUrl(candidate, baseUrl);
    if (social && !socials[social.key as keyof typeof socials]) {
      socials[social.key as keyof typeof socials] = social.url;
    }
  }

  return socials;
}

function pickContactUrls(html: string, baseUrl: string) {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }

  const urls: string[] = [];
  let match: RegExpExecArray | null;

  HREF_REGEX.lastIndex = 0;
  while ((match = HREF_REGEX.exec(html))) {
    const fullUrl = safeUrl(match[1], baseUrl);
    if (!fullUrl) continue;

    try {
      const url = new URL(fullUrl);
      if (url.hostname !== base.hostname) continue;
      const path = decodeURIComponent(url.pathname).toLowerCase();
      if (!/(contato|contact|sobre|about|quem-somos|institucional|empresa|localizacao|unidades)/i.test(path)) continue;
      if (!urls.includes(url.toString())) urls.push(url.toString());
      if (urls.length >= 2) break;
    } catch {}
  }

  return urls;
}

function applySignalsToLead(lead: any, html: string, baseUrl: string) {
  if (!lead.email) lead.email = pickEmail(html);
  if (!lead.cnpj) lead.cnpj = pickCnpj(html);

  // Tenta extrair telefone do HTML do site (fallback pra quando o Maps não tem)
  if (!lead.telefone || lead.telefone === 'Não informado') {
    const text = html.replace(/<[^>]*>/g, ' ');
    const telMatch = text.match(/\(?\d{2,3}\)?\s?\d{4,5}[\s-]?\d{4}/);
    if (telMatch) lead.telefone = normalizePhone(telMatch[0]);
  }

  const socials = pickSocialLinks(html, baseUrl);
  if (!lead.instagram) lead.instagram = socials.instagram;
  if (!lead.facebook) lead.facebook = socials.facebook;
  if (!lead.tiktok) lead.tiktok = socials.tiktok;
}

// Enriquecimento: visita o site da empresa e caca contatos, CNPJ e redes.
// IMPORTANTE: NÃO inventar email por fallback. Melhor vir vazio do que enviar lead com email falso.

// Cache de enriquecimento por domínio (evita refetch do mesmo site)
const enrichCache = new Map<string, { email: string; cnpj: string; instagram: string; facebook: string; tiktok: string }>();

async function enrichLead(lead: any) {
  lead.email = lead.email || '';
  lead.instagram = lead.instagram || '';
  lead.facebook = lead.facebook || '';
  lead.tiktok = lead.tiktok || '';
  lead.cnpj = lead.cnpj || '';

  if (!lead.site || lead.site === 'Sem site') return lead;

  // Se o site é do Google/Google APIs (falso positivo), zera e retorna
  try {
    const siteHost = new URL(lead.site).hostname.replace(/^www\./, '').toLowerCase();
    if (isGoogleOwnedHost(siteHost)) {
      lead.site = 'Sem site';
      lead.email = '';
      return lead;
    }
  } catch {
    // URL inválida — não tenta enriquecer
    lead.site = 'Sem site';
    return lead;
  }

  try {
    const domain = extractDomain(lead.site);
    // 1. Tenta cache
    if (domain && enrichCache.has(domain)) {
      const cached = enrichCache.get(domain)!;
      if (!lead.email) lead.email = cached.email;
      if (!lead.cnpj) lead.cnpj = cached.cnpj;
      if (!lead.instagram) lead.instagram = cached.instagram;
      if (!lead.facebook) lead.facebook = cached.facebook;
      if (!lead.tiktok) lead.tiktok = cached.tiktok;
      return lead;
    }

    const homeHtml = await fetchHtml(lead.site);
    if (!homeHtml) {
      // Site não respondeu — não inventa email falso
      return lead;
    }

    applySignalsToLead(lead, homeHtml, lead.site);

    const contactUrls = pickContactUrls(homeHtml, lead.site);
    if (contactUrls.length > 0 && (!lead.email || !lead.cnpj || !lead.instagram || !lead.facebook || !lead.tiktok)) {
      const extraPages = await Promise.all(contactUrls.map(url => fetchHtml(url)));
      extraPages.forEach((html, index) => {
        if (html) applySignalsToLead(lead, html, contactUrls[index]);
      });
    }

    // 2. Salva no cache
    if (domain) {
      enrichCache.set(domain, {
        email: lead.email,
        cnpj: lead.cnpj,
        instagram: lead.instagram,
        facebook: lead.facebook,
        tiktok: lead.tiktok,
      });
    }
  } catch (e) { /* Timeout ou site fora do ar - ok, continua */ }

  return lead;
}

function extractDomain(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch { return null; }
}

// Converte filterRule string única ou lista para array de regras
function parseFilterRules(filterRule: string): string[] {
  if (!filterRule || filterRule === 'none') return [];
  return filterRule.split(',').map(r => r.trim()).filter(Boolean);
}

// Pré-filtro rápido ANTES de enriquecer (aplicado na extração do Maps)
// phone e site NÃO são filtrados aqui — a segunda passagem (place pages) pode recuperá-los
function preFilter(lead: any, filterRule: string): boolean {
  const rules = parseFilterRules(filterRule);
  if (rules.length === 0) return true;
  return rules.every(rule => {
    if (['phone', 'site'].includes(rule)) return true;
    return true;
  });
}

// Pós-filtro DEPOIS de enriquecer + segunda passagem (para todos os filtros)
function postFilter(lead: any, filterRule: string): boolean {
  const rules = parseFilterRules(filterRule);
  if (rules.length === 0) return true;
  return rules.every(rule => {
    if (rule === 'phone') return lead.telefone && lead.telefone !== 'Não informado';
    if (rule === 'site') return lead.site && lead.site !== 'Sem site';
    if (rule === 'email') return !!lead.email;
    if (rule === 'insta') return !!lead.instagram;
    if (rule === 'face') return !!lead.facebook;
    if (rule === 'tiktok') return !!lead.tiktok;
    if (rule === 'cnpj') return !!lead.cnpj;
    return true;
  });
}

function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Bairros para cidades grandes — usado para expandir busca quando targetLimit é alto.
// O Google Maps limita a ~100-120 resultados por URL. Variar por bairro permite
// extrair muito mais leads em uma única cidade.
function getCityBairros(location: string): string[] {
  const loc = location.trim();
  // Rio de Janeiro — 90+ bairros oficiais (zonas Sul, Norte, Oeste, Centro)
  if (/rio\s+de\s+janeiro/i.test(loc)) {
    return [
      'Copacabana', 'Ipanema', 'Leblon', 'Botafogo', 'Flamengo',
      'Laranjeiras', 'Catete', 'Glória', 'Santa Teresa', 'Lapa',
      'Tijuca', 'Vila Isabel', 'Maracanã', 'Grajaú', 'Méier',
      'Engenho Novo', 'Cachambi', 'Del Castilho', 'Bonsucesso', 'Ramos',
      'Penha', 'Olaria', 'Madureira', 'Cascadura', 'Piedade',
      'Campo Grande', 'Bangu', 'Realengo', 'Santa Cruz', 'Guaratiba',
      'Jacarepaguá', 'Barra da Tijuca', 'Recreio', 'Taquara', 'Curicica',
      'São Cristóvão', 'Benfica', 'Mangueira', 'Vila Kennedy',
    ];
  }
  // São Paulo — 96 distritos
  if (/s[aã]o\s+paulo/i.test(loc) && !/josé|bernardo|caetano|vicente|and[dr]é/i.test(loc)) {
    return [
      'Pinheiros', 'Vila Madalena', 'Jardins', 'Itaim Bibi', 'Moema',
      'Vila Mariana', 'Perdizes', 'Pompeia', 'Lapa', 'Barra Funda',
      'Consolação', 'Bela Vista', 'Liberdade', 'Aclimação', 'Higienópolis',
      'Brooklin', 'Morumbi', 'Butantã', 'Vila Olímpia', 'Berrini',
      'Tatuapé', 'Mooca', 'Brás', 'Belenzinho', 'Anália Franco',
      'Santana', 'Tucuruvi', 'Jaçanã', 'Vila Guilherme', 'Vila Maria',
      'São Miguel', 'Itaquera', 'Guaianases', 'São Mateus', 'Sapopemba',
      'Santo Amaro', 'Campo Limpo', 'Capão Redondo', 'Jardim Ângela',
    ];
  }
  // Belo Horizonte
  if (/belo\s+horizonte/i.test(loc)) {
    return [
      'Savassi', 'Lourdes', 'Funcionários', 'Mangabeiras', 'Serra',
      'Pampulha', 'Cidade Nova', 'Santa Tereza', 'Floresta', 'Santa Efigênia',
      'Buritis', 'Estoril', 'Castelo', 'Barreiro', 'Betânia',
    ];
  }
  // Brasília
  if (/bras[ií]lia/i.test(loc)) {
    return [
      'Asa Sul', 'Asa Norte', 'Sudoeste', 'Octogonal', 'Lago Sul', 'Lago Norte',
      'Águas Claras', 'Taguatinga', 'Ceilândia', 'Guará', 'Samambaia',
    ];
  }
  // Curitiba
  if (/curitiba/i.test(loc)) {
    return [
      'Batel', 'Água Verde', 'Centro Cívico', 'Juvevê', 'Cabral',
      'Bigorrilho', 'Champagnat', 'Mossunguê', 'Portão', 'Santa Felicidade',
      'Boqueirão', 'Sítio Cercado', 'Bairro Alto', 'Jardim Social',
    ];
  }
  return [];
}

const MAJOR_CITIES = [
  'São Paulo, SP', 'Rio de Janeiro, RJ', 'Belo Horizonte, MG',
  'Brasília, DF', 'Salvador, BA', 'Fortaleza, CE',
  'Curitiba, PR', 'Manaus, AM', 'Recife, PE', 'Porto Alegre, RS',
  'Belém, PA', 'Goiânia, GO', 'Campinas, SP', 'São Luís, MA',
  'Maceió, AL', 'Natal, RN', 'Campo Grande, MS', 'Teresina, PI',
  'João Pessoa, PB', 'São José dos Campos, SP', 'Ribeirão Preto, SP',
  'Uberlândia, MG', 'Sorocaba, SP', 'Cuiabá, MT', 'Joinville, SC',
  'Londrina, PR', 'Juiz de Fora, MG', 'Florianópolis, SC',
  'Maringá, PR', 'Blumenau, SC', 'Aracaju, SE', 'Feira de Santana, BA',
  'Caxias do Sul, RS', 'Vila Velha, ES', 'Jundiaí, SP', 'Piracicaba, SP',
  'Bauru, SP', 'Olinda, PE', 'Canoas, RS', 'Ponta Grossa, PR',
  'Franca, SP', 'Cascavel, PR', 'São José do Rio Preto, SP',
  'Petrópolis, RJ', 'Caruaru, PE', 'Macaé, RJ', 'Cabo Frio, RJ',
  'Guarujá, SP', 'Indaiatuba, SP', 'Americana, SP', 'Araraquara, SP',
  'Marília, SP', 'Mogi Guaçu, SP', 'São Carlos, SP', 'Sumaré, SP',
  'Araçatuba, SP', 'Cotia, SP', 'Diadema, SP',
  'Limeira, SP', 'Mogi das Cruzes, SP', 'Osasco, SP',
  'Praia Grande, SP', 'Suzano, SP', 'Hortolândia, SP', 'Itu, SP',
  'Jacareí, SP', 'Pindamonhangaba, SP', 'Botucatu, SP',
  'Bragança Paulista, SP', 'Ferraz de Vasconcelos, SP', 'Itapevi, SP',
  'Itapecerica da Serra, SP', 'Votuporanga, SP',   'Ourinhos, SP',
  // AC
  'Rio Branco, AC',
  // AP
  'Macapá, AP',
  // RO
  'Porto Velho, RO', 'Ji-Paraná, RO',
  // RR
  'Boa Vista, RR',
  // TO
  'Palmas, TO', 'Araguaína, TO',
  // AL
  'Arapiraca, AL',
  // BA
  'Vitória da Conquista, BA', 'Ilhéus, BA', 'Porto Seguro, BA', 'Juazeiro, BA',
  // CE
  'Juazeiro do Norte, CE', 'Sobral, CE', 'Caucaia, CE',
  // ES
  'Serra, ES', 'Vitória, ES', 'Cariacica, ES',
  // GO
  'Anápolis, GO', 'Aparecida de Goiânia, GO', 'Rio Verde, GO',
  // MA
  'Imperatriz, MA',
  // MG
  'Contagem, MG', 'Uberaba, MG', 'Montes Claros, MG', 'Governador Valadares, MG', 'Ipatinga, MG', 'Divinópolis, MG',
  // MS
  'Dourados, MS', 'Três Lagoas, MS',
  // MT
  'Várzea Grande, MT', 'Rondonópolis, MT', 'Sinop, MT',
  // PA
  'Santarém, PA', 'Ananindeua, PA', 'Marabá, PA',
  // PB
  'Campina Grande, PB', 'Patos, PB',
  // PE
  'Jaboatão dos Guararapes, PE', 'Paulista, PE', 'Garanhuns, PE',
  // PI
  'Parnaíba, PI', 'Picos, PI',
  // PR
  'Foz do Iguaçu, PR', 'Guarapuava, PR', 'Toledo, PR',
  // RJ
  'Niterói, RJ', 'Duque de Caxias, RJ', 'Campos dos Goytacazes, RJ', 'Volta Redonda, RJ', 'Angra dos Reis, RJ',
  // RN
  'Mossoró, RN', 'Parnamirim, RN',
  // RS
  'Pelotas, RS', 'Santa Maria, RS', 'Passo Fundo, RS', 'Novo Hamburgo, RS',
  // SC
  'Itajaí, SC', 'Chapecó, SC', 'Criciúma, SC', 'Balneário Camboriú, SC',
  // SE
  'Nossa Senhora do Socorro, SE', 'Lagarto, SE',
  // SP
  'Atibaia, SP', 'Itapetininga, SP', 'Registro, SP',
];

export async function POST(request: Request) {
  let auth: Awaited<ReturnType<typeof getAuthUser>>;
  let extractionDone = false;
  function done() {
    if (!extractionDone) {
      extractionDone = true;
      if (auth) {
        const c = activeExtractions.get(auth.user.id) || 1;
        if (c <= 1) activeExtractions.delete(auth.user.id);
        else activeExtractions.set(auth.user.id, c - 1);
      }
    }
  }

  try {
    auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Nao autenticado. Faca login para extrair leads.' }, { status: 401 });
    }

    // Rate limit: máximo 2 extrações simultâneas por usuário, 10 global
    const current = activeExtractions.get(auth.user.id) || 0;
    activeExtractions.set(auth.user.id, current + 1);
    if (current >= MAX_CONCURRENT_PER_USER) {
      activeExtractions.set(auth.user.id, current);
      return NextResponse.json({
        error: `Você já tem ${current} extrações em andamento. Aguarde uma finalizar antes de iniciar outra.`
      }, { status: 429 });
    }
    if (getGlobalConcurrent() >= MAX_GLOBAL_CONCURRENT) {
      activeExtractions.set(auth.user.id, current);
      return NextResponse.json({
        error: 'Sistema sobrecarregado. Tente novamente em alguns segundos.'
      }, { status: 503 });
    }

    const { keyword: rawKeyword, location: rawLocation, limit, filterRule, existingLeadKeys } = await request.json();
    const requestSupabase = createRequestSupabaseClient(request);

    if (!rawKeyword || !rawLocation) {
      done();
      return NextResponse.json({ error: 'Preencha o termo e a cidade.' }, { status: 400 });
    }

    if (filterRule && filterRule !== 'none') {
      const featureMap: Record<string, FeatureKey> = {
        email: 'emailEnrichment',
        cnpj: 'cnpjEnrichment',
        insta: 'socialEnrichment',
        face: 'socialEnrichment',
        tiktok: 'socialEnrichment'
      };
      const rules = parseFilterRules(filterRule);
      for (const rule of rules) {
        const requiredFeature = featureMap[rule];
        if (requiredFeature && !requireFeature(auth.planId, requiredFeature)) {
          done();
          return NextResponse.json({
            error: `Filtro "${rule}" exige plano superior. Faca upgrade para usar.`
          }, { status: 403 });
        }
      }
    }

    if (auth.tokens <= 0) {
      done();
      return NextResponse.json({ error: 'Sem tokens disponiveis. Compre mais tokens para continuar extraindo.' }, { status: 402 });
    }

    const { correctedKeyword, correctedLocation } = smartNormalizeQuery(rawKeyword, rawLocation);
    const keyword = correctedKeyword;
    const location = correctedLocation;
    const isBroadRegion = isBroadLocation(rawLocation) || isBroadLocation(correctedLocation);
    const requestedLimit = Math.max(1, Number(limit) || 10);
    const targetLimit = Math.min(requestedLimit, 200, auth.tokens);
    if (targetLimit === 0) {
      done();
      return NextResponse.json({ error: 'Saldo insuficiente. Compre mais tokens.' }, { status: 402 });
    }

    // RESERVA ANTECIPADA: bloqueia os tokens ANTES de criar o job
    const reservation = await reserveTokens(auth.user.id, targetLimit);
    if ('error' in reservation) {
      done();
      return NextResponse.json({ error: reservation.error }, { status: reservation.status });
    }

    // Cria job no Supabase e dispara extração em background
    const { data: jobData, error: jobError } = await requestSupabase.from('extraction_jobs').insert({
      user_id: auth.user.id, status: 'running',
      keyword, location, filter_rule: filterRule || '',
      leads_count: 0, scanned: 0, cities_scanned: 0, search_time_seconds: 0,
      started_at: new Date().toISOString(),
      reservation_id: reservation.reservationId,
    }).select('id').single();
    if (jobError || !jobData) {
      // Reembolsa a reserva se falhou ao criar job
      await refundReservation(reservation.reservationId);
      done();
      console.error('Falha ao criar job:', jobError);
      return NextResponse.json({ error: 'Falha ao iniciar extração. Tente novamente.' }, { status: 500 });
    }
    const jobId = jobData.id;

    // Atualiza reserva com jobId
    const adminSupabase = createAdminSupabaseClient();
    await adminDb.from('token_reservations').update({ job_id: jobId }).eq('id', reservation.reservationId);

    runExtraction({
      jobId, auth, requestSupabase,
      keyword, location, isBroadRegion,
      targetLimit, filterRule: filterRule || '',
      correctedKeyword, correctedLocation,
      existingLeadKeys: existingLeadKeys || [],
      reservationId: reservation.reservationId,
    }).finally(done);

    return NextResponse.json({ success: true, jobId, message: 'Extração iniciada em segundo plano.' });

  } catch (error: any) {
    done();
    const msg = error instanceof Error ? error.message : String(error);
    console.error("ERRO AO CRIAR JOB:", msg);
    return NextResponse.json({ error: 'Erro ao iniciar extração: ' + msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Atualiza job no Supabase (usado por runExtraction e pelo timer de progresso)
// ---------------------------------------------------------------------------
async function updateJob(jobId: string, updates: Record<string, any>) {
  await adminDb.from('extraction_jobs').update(updates).eq('id', jobId);
}

const adminDb = createAdminSupabaseClient();

// ---------------------------------------------------------------------------
// Executa a extração em background (não-agendada, fire-and-forget)
// ---------------------------------------------------------------------------
async function runExtraction({
  jobId, auth, requestSupabase,
  keyword, location, isBroadRegion,
  targetLimit, filterRule,
  correctedKeyword, correctedLocation,
  existingLeadKeys, reservationId,
}: {
  jobId: string;
  auth: NonNullable<Awaited<ReturnType<typeof getAuthUser>>>;
  requestSupabase: ReturnType<typeof createRequestSupabaseClient>;
  keyword: string;
  location: string;
  isBroadRegion: boolean;
  targetLimit: number;
  filterRule: string;
  correctedKeyword: string;
  correctedLocation: string;
  existingLeadKeys: string[];
  reservationId: string;
}) {
  let browser;
  let updateTimer: ReturnType<typeof setInterval> | null = null;

  async function updateProgress() {
    try {
      await updateJob(jobId, {
        scanned: scrapedNames.size,
        leads_count: validLeads.length,
        cities_scanned: citiesDone,
        message: `${validLeads.length} leads encontrados em ${citiesDone} cidades`,
        search_time_seconds: Math.round((Date.now() - startTime) / 1000),
      });
    } catch {}
  }

const startTime = Date.now();
    // Tempo proporcional ao targetLimit: ~3s por lead + margem. Mínimo 45s, máximo 30min.
    const MAX_TIME = isBroadRegion
      ? Math.min(1800000, 15000 + targetLimit * 3000)
      : Math.min(1800000, Math.max(45000, targetLimit * 3000));
  const validLeads: any[] = [];
  const scrapedKeys = new Set<string>(existingLeadKeys);
  const scrapedNames = new Set<string>(existingLeadKeys.map(k => k.split('|')[0]).filter(Boolean));
  const scrapedPhones = new Set<string>(existingLeadKeys.map(k => k.split('|')[1]).filter(Boolean));
  let citiesDone = 0;
  let _cancelled = false;

  let _lastCancelCheck = 0;
  async function checkCancelled(): Promise<boolean> {
    if (_cancelled) return true;
    const now = Date.now();
    if (now - _lastCancelCheck < 5000) return false;
    _lastCancelCheck = now;
    try {
      const supabase = createAdminSupabaseClient();
      const { data } = await supabase.from('extraction_jobs').select('status').eq('id', jobId).single();
      if (data?.status === 'cancelled') { _cancelled = true; return true; }
    } catch {}
    return false;
  }

  updateTimer = setInterval(updateProgress, 5000);

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      geolocation: { latitude: -23.5505, longitude: -46.6333 },
      permissions: ['geolocation'],
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    // Bloqueia recursos não essenciais de forma stealth (204 em vez de abort)
    await context.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2}', route => route.fulfill({ status: 204, body: '' }));

    // Cookies de consentimento proativos (evita popup de cookies)
    await page.context().addCookies([
      { name: 'CONSENT', value: 'YES+cb.20250522-13-p0.en+FX+937', domain: '.google.com', path: '/' },
      { name: 'SOCS', value: 'CAISHAgENhB0Dcm9sZQ==', domain: '.google.com', path: '/' },
    ]);

const allEnrichedLeads: any[] = [];

    // Para buscas em cidades grandes com targetLimit alto, expande por bairros
    // O Google Maps limita resultados por busca a ~100-120 itens.
    // Para chegar a 200 leads em uma cidade, precisamos variar a busca por sub-regiões.
    let searchLocations: string[];
    if (isBroadRegion) {
      searchLocations = shuffleArray([...MAJOR_CITIES]);
    } else if (targetLimit >= 150) {
      const cityBairros = getCityBairros(location);
      if (cityBairros.length > 1) {
        // Bairros precisam do nome da cidade junto para o Maps entender
        const mainCity = location.replace(/,?\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/i, '').trim();
        const bairroQueries = cityBairros.map(b => `${b}, ${mainCity}`);
        searchLocations = [location, ...shuffleArray(bairroQueries)];
      } else {
        searchLocations = [location];
      }
    } else {
      searchLocations = [location];
    }
    // Scroll por cidade/bairro baseado na demanda e tempo disponível
    const maxScrollPerCity = isBroadRegion ? 15 : Math.max(15, Math.min(100, targetLimit));

    // Para targets grandes, gera variações de nicho (Maps retorna resultados DIFERENTES)
    // Ex: "Academia" → "Personal Trainer", "Crossfit", "Musculação", "Ginástica"
    const nicheVariations = (kw: string) => {
      const kwLower = kw.toLowerCase();
      if (targetLimit <= 100) return [kw];
      // Mapeamento de nichos comuns para variações que retornam leads diferentes
      const variants: Record<string, string[]> = {
        'academia': ['Personal Trainer', 'Crossfit', 'Centro de Treinamento', 'Musculação', 'Ginástica'],
        'restaurante': ['Restaurante', 'Bar', 'Lanchonete', 'Pizzaria', 'Hamburgueria'],
        'dentista': ['Dentista', 'Odontologia', 'Implante Dentário', 'Clínica Odontológica'],
        'advogado': ['Advogado', 'Escritório de Advocacia', 'Consultoria Jurídica'],
        'medico': ['Médico', 'Clínica', 'Consultório', 'Especialidade Médica'],
        'estetica': ['Estética', 'Salão de Beleza', 'Depilação', 'Massagem', 'Spa'],
        'petshop': ['Petshop', 'Veterinário', 'Banho e Tosa', 'Hotel para Cães'],
      };
      for (const [base, vars] of Object.entries(variants)) {
        if (kwLower.includes(base)) return [kw, ...vars];
      }
      return [kw];
    };

    const keywordsToTry = nicheVariations(keyword);

    for (const searchLoc of searchLocations) {
      if (allEnrichedLeads.length >= targetLimit) break;
      if ((Date.now() - startTime) >= MAX_TIME) break;
      if (await checkCancelled()) break;

      // Para cada keyword variation, faz uma busca separada (Maps retorna leads diferentes)
      for (const kwVar of keywordsToTry) {
        if (allEnrichedLeads.length >= targetLimit) break;
        if ((Date.now() - startTime) >= MAX_TIME) break;
        if (await checkCancelled()) break;

      const cityQuery = encodeURIComponent(`${kwVar} em ${searchLoc}`);
      await page.goto(`https://www.google.com/maps/search/${cityQuery}`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      // Detecta bloqueio do Google (CAPTCHA)
      const pageTitle = await page.title().catch(() => '');
      const pageUrl = page.url();
      if (pageUrl.includes('sorry') || pageUrl.includes('captcha') || pageTitle.toLowerCase().includes('captcha') || pageTitle.toLowerCase().includes('sorry')) {
        if (updateTimer) clearInterval(updateTimer);
        // Reembolsa reserva em caso de bloqueio do Google
        await refundReservation(reservationId);
        await updateJob(jobId, {
          status: 'failed',
          error: 'Google bloqueou a busca. Tente novamente em alguns minutos.',
          search_time_seconds: Math.round((Date.now() - startTime) / 1000),
          completed_at: new Date().toISOString(),
        });
        await browser.close();
        return;
      }

      // Verifica se o feed carregou
      try {
        await page.waitForSelector('div[role="feed"], div[role="main"]', { timeout: 12000 });
      } catch {
        continue; // Sem resultados nesta cidade, tenta próxima
      }
      // Aguarda cards carregarem de fato
      await page.waitForTimeout(1500 + Math.random() * 1000);
      try {
        await page.waitForSelector('a[href*="/maps/place"]', { timeout: 5000 });
      } catch {
        // Pode não ter resultados, continua mesmo assim
      }

      await page.waitForTimeout(1000 + Math.random() * 500);

      let cityScrolls = 0;
      let emptyScrolls = 0;

      while (allEnrichedLeads.length < targetLimit && (Date.now() - startTime) < MAX_TIME && cityScrolls < maxScrollPerCity && !(await checkCancelled())) {
      
      // 1. Extrai todos os cards visíveis da tela
      const rawChunk = await page.evaluate(() => {
        const chunk: any[] = [];
        const items = document.querySelectorAll('div[role="feed"] > div > div > a[href*="/maps/place"]');
        
        for (const anchor of items) {
          try {
            const container = anchor.closest('div[role="feed"] > div > div') || anchor.parentElement;
            if (!container) continue;
            
            const nameEl = container.querySelector('.fontHeadlineSmall') || container.querySelector('[class*="fontHeadline"]');
            if (!nameEl) continue;
            
            const nome = (nameEl as HTMLElement).innerText?.trim();
            if (!nome || nome.length < 2) continue;

            const text = (container as HTMLElement).innerText || '';
            
            // Telefone - extração híbrida avançada
            let telefone = 'Não informado';
            
            // 1. Procura por botões ou links de ligar com aria-label (ex: "Ligar para +55 11 99999-9999")
            const els = container.querySelectorAll('[aria-label]');
            for (const el of els) {
              const label = el.getAttribute('aria-label') || '';
              if (label.includes('Ligar') || label.includes('Call') || label.includes('ligar')) {
                const match = label.match(/\+?\d[\d\s\-\(\)]{8,18}\d/);
                if (match) {
                  telefone = match[0].trim();
                  break;
                }
              }
            }

            // 2. Fallback: procura por atributo data-phone-number
            if (telefone === 'Não informado') {
              const phoneBtn = container.querySelector('[data-phone-number]');
              if (phoneBtn) {
                const p = phoneBtn.getAttribute('data-phone-number');
                if (p) telefone = p.trim();
              }
            }

            // 3. Fallback: regex no texto do card
            if (telefone === 'Não informado') {
              const telMatch = text.match(/\(?\d{2,3}\)?\s?\d{4,5}[\s-]?\d{4}/);
              if (telMatch) {
                telefone = telMatch[0];
              }
            }

            // 4. Fallback: botão de telefone no card (internacional)
            if (telefone === 'Não informado') {
              const phoneEl = container.querySelector('button[data-value][data-tooltip*="telefone"], button[data-value][data-tooltip*="phone"]');
              if (phoneEl) {
                const v = phoneEl.getAttribute('data-value');
                if (v) telefone = v.trim();
              }
            }

            // 5. Fallback: links tel:
            if (telefone === 'Não informado') {
              const telLink = container.querySelector('a[href^="tel:"]');
              if (telLink) {
                const t = telLink.getAttribute('href')?.replace('tel:', '').trim();
                if (t) telefone = t;
              }
            }

            // 6. Fallback: WhatsApp links
            if (telefone === 'Não informado') {
              const waLink = container.querySelector('a[href*="wa.me"], a[href*="whatsapp.com"]');
              if (waLink) {
                const href = waLink.getAttribute('href') || '';
                const wm = href.match(/(\d{10,15})/);
                if (wm) telefone = wm[1];
              }
            }

            // 7. Fallback: itemprop telephone
            if (telefone === 'Não informado') {
              const item = container.querySelector('[itemprop="telephone"]');
              if (item) telefone = (item as HTMLElement).innerText?.trim() || '';
            }

            // 8. Fallback: data-item-id com phone
            if (telefone === 'Não informado') {
              const el = container.querySelector('[data-item-id*="phone"]');
              if (el) {
                const v = el.getAttribute('aria-label') || el.getAttribute('data-value') || (el as HTMLElement).innerText;
                if (v) {
                  const m = v.match(/(\+?\d[\d\s\-\(\)]{8,18}\d)/);
                  if (m) telefone = m[1].trim();
                }
              }
            }

            // 9. Fallback: regex melhorado no texto (inclui +55)
            if (telefone === 'Não informado') {
              const patterns = [
                /(\+55\s?)?\(?\d{2}\)?\s?\d{4,5}[\s-]?\d{4}/g,
                /\+?\d{2}[\s-]?\d{2}[\s-]?\d{4,5}[\s-]?\d{4}/g,
              ];
              for (const pat of patterns) {
                const m = text.match(pat);
                if (m && m[0].length >= 10) { telefone = m[0].trim(); break; }
              }
            }

            // Avaliação via aria-label semântico (mais preciso que regex)
            let avaliacao = 'N/A';
            const ratingEl = container.querySelector('[role="img"][aria-label*="estrelas"], [role="img"][aria-label*="stars"]');
            if (ratingEl) {
              const ariaLabel = ratingEl.getAttribute('aria-label') || '';
              const rMatch = ariaLabel.match(/(\d[.,]\d)/);
              if (rMatch) avaliacao = rMatch[1].replace(',', '.');
            }
            if (avaliacao === 'N/A') {
              const rMatch = text.match(/(\d[.,]\d)\s*(?:estrela|star|\(|$)/i);
              if (rMatch) avaliacao = rMatch[1].replace(',', '.');
            }

            // Categoria (tipo de negócio ex: "Restaurante italiano")
            let categoria = '';
            const textParts = text.split('\n').filter(p => p.trim());
            for (let i = 0; i < textParts.length; i++) {
              const part = textParts[i].trim();
              if (part.includes('·') || part.includes('R$')) {
                const catMatch = part.match(/^(.+?)\s*(?:·|R\$)/);
                if (catMatch) categoria = catMatch[1].trim();
                break;
              }
            }

            // Endereço
            let endereco = '';
            for (const part of textParts) {
              const addrMatch = part.match(/((?:Rua|Av\.?|Avenida|Travessa|Praça|Alameda|Rodovia)\s.+)/i);
              if (addrMatch) { endereco = addrMatch[1]; break; }
            }
            if (!endereco) {
              const addrMatch = text.match(/([A-Za-zÀ-ÿ\s]+\d+\s*-\s*[A-Za-zÀ-ÿ\s]+,\s*[A-Za-zÀ-ÿ\s]+-[A-Z]{2})/);
              if (addrMatch) endereco = addrMatch[1];
            }

            // Horários (ex: "Aberto ⋅ Fecha às 22:00")
            let horarios = '';
            const hoursMatch = text.match(/(Aberto|Fechado)(?:\s*⋅\s*)(.+?)(?:\.|$)/i);
            if (hoursMatch) horarios = hoursMatch[0].trim();

            // CEP
            const cepMatch = text.match(/\d{5}-?\d{3}/);
            const cep = cepMatch ? cepMatch[0] : '';

            // Review count
            const reviewCountMatch = text.match(/\((\d[\d.]*)\)\s*(?:avalia|review)/i);
            const reviewCount = reviewCountMatch ? reviewCountMatch[1] : '';

            // Site oficial
            let site = 'Sem site';
            const allLinks = container.querySelectorAll('a[href]');
            for (const link of allLinks) {
              const href = (link as HTMLAnchorElement).href;
              if (href && !href.includes('google.com') && !href.includes('maps') && href.startsWith('http')) {
                site = href;
                break;
              }
            }

            // Place URL
            const placeUrl = (anchor as HTMLAnchorElement).href || '';
            
            chunk.push({ nome, telefone, avaliacao, site, placeUrl, cep, reviewCount, categoria, endereco, horarios });
          } catch(e) {}
        }
        return chunk;
      });

      // 2. Filtra novos leads (não repetidos) — nome composto + telefone
      const newLeads = rawChunk.filter(l => {
        if (scrapedNames.has(l.nome)) return false;
        if (l.telefone !== 'Não informado' && scrapedPhones.has(l.telefone)) return false;
        return true;
      });
      newLeads.forEach(l => {
        scrapedNames.add(l.nome);
        if (l.telefone !== 'Não informado') scrapedPhones.add(l.telefone);
      });

      if (newLeads.length === 0) {
        emptyScrolls++;
        if (emptyScrolls >= (targetLimit <= 100 ? 8 : 20)) break; // Sem mais resultados
      } else {
        emptyScrolls = 0;
      }

      if (newLeads.length > 0) {
        // 3. Aplica PRÉ-FILTRO (rápido, sem visitar sites)
        const preFiltered = newLeads.filter(l => preFilter(l, filterRule));
        
        if (preFiltered.length > 0) {
          // 4. Completa telefone/site no Maps antes de entregar o lote em tempo real.
          await enrichLeadsWithMapsPlaceDetails(context, preFiltered, async () =>
            await checkCancelled() || (Date.now() - startTime) >= MAX_TIME
          );

          // 5. Enriquece APENAS os que passaram no pré-filtro (economiza tempo!)
          const enriched = await Promise.all(preFiltered.map(lead => {
            // Normaliza telefone antes de enriquecer
            if (lead.telefone && lead.telefone !== 'Não informado') lead.telefone = normalizePhone(lead.telefone);
            return enrichLead(lead);
          }));
          
          // 5. Acumula TODOS os leads enriquecidos (segunda passada roda antes do pós-filtro)
          for (const lead of enriched) {
            allEnrichedLeads.push(lead);
            if (allEnrichedLeads.length >= targetLimit) break;
          }
          // Salva leads no storage seguro (extraction_results) - ainda nao visivel pro usuario
          try {
            await saveExtractionResults(Number(jobId), auth.user.id, allEnrichedLeads);
            await updateJob(jobId, {
              leads_count: allEnrichedLeads.length,
              scanned: scrapedNames.size,
              cities_scanned: citiesDone,
              message: `${allEnrichedLeads.length} leads encontrados...`,
              search_time_seconds: Math.round((Date.now() - startTime) / 1000),
            });
          } catch {}
        }
      }

      // Scroll para carregar mais resultados
      if (allEnrichedLeads.length < targetLimit) {
        await page.evaluate(() => {
          const feed = document.querySelector('div[role="feed"]');
          if (feed) feed.scrollBy(0, 1200 + Math.random() * 600);
        });
        await page.waitForTimeout(800 + Math.random() * 600);
      }
      cityScrolls++;
    }
    } // fim for (const query of queries)
    citiesDone++;
    // Salva ALL enriched leads no storage seguro (ainda nao visivel)
    if (allEnrichedLeads.length > 0) {
      try {
        await saveExtractionResults(Number(jobId), auth.user.id, allEnrichedLeads);
        await updateJob(jobId, {
          leads_count: allEnrichedLeads.length,
          scanned: scrapedNames.size,
          cities_scanned: citiesDone,
          message: `${allEnrichedLeads.length} leads enriquecidos em ${citiesDone} cidades`,
          search_time_seconds: Math.round((Date.now() - startTime) / 1000),
        });
      } catch {}
    }
  }

  // Segunda passada: extrair dados faltantes de leads (telefone e site) das páginas individuais do Maps
  // Roda ANTES do pós-filtro para maximizar a coleta independente do filtro escolhido
  const leadsParaSegundaPassagem = allEnrichedLeads.filter(l =>
    (l.telefone === 'Não informado' || !l.site || l.site === 'Sem site') && l.placeUrl
  );
    const BATCH_SIZE = 5;
    const MAX_SECOND_PASS = leadsParaSegundaPassagem.length;
    for (let i = 0; i < MAX_SECOND_PASS; i += BATCH_SIZE) {
      if (await checkCancelled()) break;
      if ((Date.now() - startTime) >= MAX_TIME) break;
      const batch = leadsParaSegundaPassagem.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (lead) => {
        let tab: any = null;
        try {
          tab = await context.newPage();
          // Tenta carregamento completo primeiro, fallback para domcontentloaded
          try {
            await tab.goto(withMapsLocale(lead.placeUrl), {
              waitUntil: 'load', timeout: 12000,
              referer: 'https://www.google.com/maps'
            });
          } catch {
            try {
              await tab.goto(withMapsLocale(lead.placeUrl), {
                waitUntil: 'domcontentloaded', timeout: 8000,
                referer: 'https://www.google.com/maps'
              });
            } catch {}
          }
          await tab.waitForTimeout(2000);

          const extraData = await tab.evaluate(() => {
            const r: any = { telefone: '', site: '', instagram: '', facebook: '', tiktok: '', endereco: '', horarios: '' };
            const text = document.body?.innerText || '';
            const html = document.body?.innerHTML || '';

            // 1. LD+JSON
            for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
              try {
                const d = JSON.parse(s.textContent || '{}');
                const items = Array.isArray(d) ? d : [d];
                for (const item of items) {
                  if (item.telephone && !r.telefone) r.telefone = item.telephone;
                  if (item.url && !r.site && !item.url.includes('google.com')) r.site = item.url;
                  if (item.sameAs) for (const url of item.sameAs) {
                    if (url.includes('instagram.com')) r.instagram = url;
                    if (url.includes('facebook.com') || url.includes('fb.com')) r.facebook = url;
                    if (url.includes('tiktok.com')) r.tiktok = url;
                  }
                  if (item.address?.streetAddress) {
                    let addr = item.address.streetAddress;
                    if (item.address.addressLocality) addr += ', ' + item.address.addressLocality;
                    if (item.address.addressRegion) addr += ' - ' + item.address.addressRegion;
                    if (item.address.postalCode) addr += ', ' + item.address.postalCode;
                    r.endereco = addr;
                  }
                }
              } catch {}
            }

            // 2. DOM selectors — telefone
            if (!r.telefone) {
              for (const sel of [
                'button[data-item-id*="phone"]', 'a[data-item-id*="phone"]', 'a[href^="tel:"]',
                '[data-phone-number]', 'button[aria-label*="telefone"]', 'button[aria-label*="phone"]',
                '[data-tooltip*="telefone"]', 'button[aria-label*="Ligar"]',
                'button[aria-label*="call"]', 'a[aria-label*="telefone"]',
              ]) {
                const el = document.querySelector(sel);
                if (!el) continue;
                const v = el.getAttribute('aria-label') || el.getAttribute('data-phone-number') ||
                          el.getAttribute('href')?.replace('tel:', '') || el.getAttribute('data-value') ||
                          (el as HTMLElement).innerText;
                if (v) { const m = v.match(/(\+?\d[\d\s\-\(\)]{8,18}\d)/); if (m) { r.telefone = m[1].trim(); break; } }
              }
            }

            // 3. Regex no text
            if (!r.telefone) {
              for (const pat of [/(\+55\s?)?\(?\d{2}\)?\s?\d{4,5}[\s-]?\d{4}/g, /\+?\d{2}[\s-]?\d{2}[\s-]?\d{4,5}[\s-]?\d{4}/g]) {
                const ms = text.match(pat);
                if (ms && ms.length > 0) { r.telefone = ms[0].trim(); break; }
              }
            }

            // 4. Site
            if (!r.site) {
              for (const sel of ['a[data-item-id*="authority"]', 'a[href^="http"]:not([href*="google"]):not([href*="maps"])']) {
                const el = document.querySelector(sel);
                if (el) { const h = el.getAttribute('href') || ''; if (h && !h.includes('google.com')) { r.site = h; break; } }
              }
            }

            // 5. Redes sociais via link href
            for (const m of html.matchAll(/https?:\/\/(?:www\.)?(instagram\.com|facebook\.com|fb\.com|tiktok\.com)\/[^\s"'<>]+/gi)) {
              const url = m[0].replace(/["'<>].*$/, '');
              if (url.includes('instagram.com') && !r.instagram) r.instagram = url;
              if ((url.includes('facebook.com') || url.includes('fb.com')) && !r.facebook) r.facebook = url;
              if (url.includes('tiktok.com') && !r.tiktok) r.tiktok = url;
            }

            // 6. Endereço
            if (!r.endereco) {
              const addrEl = document.querySelector('[data-item-id*="address"]');
              if (addrEl) r.endereco = (addrEl as HTMLElement).innerText?.trim() || '';
            }

            // 7. Horários
            const hMatch = text.match(/(Aberto|Fechado)(?:\s*⋅\s*)(.+?)(?:\.|$)/i);
            if (hMatch) r.horarios = hMatch[0].trim();

            return r;
          });

          if (extraData.telefone) lead.telefone = normalizePhone(extraData.telefone);
          if (extraData.site && (!lead.site || lead.site === 'Sem site')) lead.site = extraData.site;
          if (extraData.instagram && !lead.instagram) lead.instagram = extraData.instagram;
          if (extraData.facebook && !lead.facebook) lead.facebook = extraData.facebook;
          if (extraData.tiktok && !lead.tiktok) lead.tiktok = extraData.tiktok;
          if (extraData.endereco && !lead.endereco) lead.endereco = extraData.endereco;
          if (extraData.horarios && !lead.horarios) lead.horarios = extraData.horarios;
        } catch {
        } finally {
          if (tab) try { await tab.close(); } catch {}
        }
      }));
    }

    // Salva leads enriquecidos no storage seguro
    if (allEnrichedLeads.length > 0) {
      try {
        await saveExtractionResults(Number(jobId), auth.user.id, allEnrichedLeads);
        await updateJob(jobId, {
          leads_count: allEnrichedLeads.length,
          scanned: scrapedNames.size,
          cities_scanned: citiesDone,
          message: `${allEnrichedLeads.length} leads enriquecidos em ${citiesDone} cidades`,
          search_time_seconds: Math.round((Date.now() - startTime) / 1000),
        });
      } catch {}
    }

    // Agora aplica o PÓS-FILTRO em todos os leads enriquecidos + segunda passada
    for (const lead of allEnrichedLeads) {
      if (postFilter(lead, filterRule)) {
        validLeads.push(lead);
        if (validLeads.length >= targetLimit) break;
      }
    }

    if (updateTimer) clearInterval(updateTimer);
    await browser.close();
    browser = null;

    // Atualiza progresso final antes de concluir
    await updateProgress();

    const gastos = validLeads.length;
    if (auth && reservationId) {
      if (gastos > 0) {
        // CONSUMO ATÔMICO: consome reserva e cria delivery (prova de entrega)
        const { data: profile } = await adminDb
          .from('profiles')
          .select('tokens')
          .eq('id', auth.user.id)
          .single();
        const currentTokens = (profile?.tokens as number) ?? 0;

        const consumeResult = await consumeReservation(reservationId, gastos, currentTokens);
        if ('error' in consumeResult) {
          console.error('[BILLING] Falha ao consumir reserva:', consumeResult.error);
          // Tenta reembolso total como fallback
          await refundReservation(reservationId);
        } else {
          // Só agora: entrega os leads para o usuario (apos pagamento confirmado)
          await deliverExtractionResults(Number(jobId), validLeads);

          // Salva histórico da extração
          try {
            await adminDb.from('extraction_history').insert({
              user_id: auth.user.id,
              keyword,
              location,
              filter_rule: filterRule || '',
              leads_found: validLeads.length,
              leads_requested: targetLimit,
              tokens_spent: gastos,
              search_time_seconds: Math.round((Date.now() - startTime) / 1000),
            });
          } catch (e) {
            console.error('[BILLING] Falha ao salvar historico:', e);
          }

          // Atualiza job como concluído com leads entregues
          await updateJob(jobId, {
            status: 'completed',
            delivered: true,
            leads_count: validLeads.length,
            scanned: scrapedNames.size,
            cities_scanned: citiesDone,
            message: `Extração concluída: ${validLeads.length} leads em ${Math.round((Date.now() - startTime) / 1000)}s`,
            search_time_seconds: Math.round((Date.now() - startTime) / 1000),
            completed_at: new Date().toISOString(),
            tokens_earned: gastos,
          });
        }
      } else {
        // Nenhum lead encontrado com filtro - reembolso total
        await refundReservation(reservationId);
        await deliverExtractionResults(Number(jobId), []);

        await updateJob(jobId, {
          status: 'completed',
          delivered: true,
          leads_count: 0,
          scanned: scrapedNames.size,
          cities_scanned: citiesDone,
          message: `Nenhum lead encontrado com os filtros selecionados. Tokens reembolsados.`,
          search_time_seconds: Math.round((Date.now() - startTime) / 1000),
          completed_at: new Date().toISOString(),
          tokens_earned: 0,
        });
      }
    }

  } catch (err: any) {
    console.error('Extraction error:', err);
    if (updateTimer) clearInterval(updateTimer);
    // Reembolsa a reserva em caso de erro
    try {
      await refundReservation(reservationId);
    } catch (refundErr) {
      console.error('[BILLING] Falha ao reembolsar apos erro:', refundErr);
    }
    try {
      await updateJob(jobId, {
        status: 'failed',
        error: err.message || 'Erro inesperado',
        search_time_seconds: Math.round((Date.now() - startTime) / 1000),
        completed_at: new Date().toISOString(),
      });
    } catch {}
    if (browser) try { await browser.close(); } catch {}
  }
}
