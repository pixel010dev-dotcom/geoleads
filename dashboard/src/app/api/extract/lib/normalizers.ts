function getLevenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = [];
  let i: number, j: number, val: number;
  for (i = 0; i <= a.length; i++) tmp[i] = [i];
  for (j = 0; j <= b.length; j++) tmp[0][j] = j;
  for (i = 1; i <= a.length; i++) {
    for (j = 1; j <= b.length; j++) {
      val = (a[i - 1] === b[j - 1]) ? 0 : 1;
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + val
      );
    }
  }
  return tmp[a.length][b.length];
}

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
  'advocacia', 'odontologia', 'autoescola', 'fotografia', 'buffet',
  'cerimonial', 'festas', 'eventos', 'acupuntura', 'massagem',
];

const TYPO_DICTIONARY: Record<string, string> = {
  'adivogado': 'advogado', 'adevogado': 'advogado', 'adivogacia': 'advocacia',
  'adevogacia': 'advocacia', 'denticta': 'dentista', 'dentixta': 'dentista',
  'restauranti': 'restaurante', 'acadimia': 'academia', 'iscola': 'escola',
  'cabelereiro': 'cabeleireiro', 'cabelerero': 'cabeleireiro',
  'cabeleirero': 'cabeleireiro', 'farmasia': 'farmácia', 'ofissina': 'oficina',
  'boracharia': 'borracharia', 'pisaria': 'pizzaria', 'pissaria': 'pizzaria',
  'hamburguerria': 'hamburgueria', 'sorveterria': 'sorveteria',
  'imobliaria': 'imobiliária', 'imobiliara': 'imobiliária',
  'estetcia': 'estética', 'esstetica': 'estética', 'esteticista': 'esteticista',
  'comfeitaria': 'confeitaria', 'contabelidade': 'contabilidade', 'medco': 'médico',
};

const LOCATION_DICTIONARY: Record<string, string> = {
  'sp': 'São Paulo', 'sao paulo': 'São Paulo', 'sao paolo': 'São Paulo',
  's. paulo': 'São Paulo', 'sãopaulo': 'São Paulo',
  'rj': 'Rio de Janeiro', 'rio': 'Rio de Janeiro', 'rio de janero': 'Rio de Janeiro',
  'bh': 'Belo Horizonte', 'belo horizonte': 'Belo Horizonte',
  'bsb': 'Brasília', 'brasilia': 'Brasília',
  'poa': 'Porto Alegre', 'porto alegre': 'Porto Alegre',
  'floripa': 'Florianópolis', 'florianopolis': 'Florianópolis',
  'curitba': 'Curitiba', 'curitiba': 'Curitiba',
  'salvado': 'Salvador', 'salvador': 'Salvador',
  'fortalesa': 'Fortaleza', 'fortaleza': 'Fortaleza',
  'recfe': 'Recife', 'recife': 'Recife',
  'goiana': 'Goiânia', 'goiania': 'Goiânia',
  'manos': 'Manaus', 'manaus': 'Manaus',
  'vitora': 'Vitória', 'vitoria': 'Vitória',
  'mg': 'Minas Gerais', 'ba': 'Bahia', 'pr': 'Paraná', 'rs': 'Rio Grande do Sul',
  'sc': 'Santa Catarina', 'go': 'Goiás', 'pe': 'Pernambuco', 'ce': 'Ceará',
  'pa': 'Pará', 'ma': 'Maranhão', 'pb': 'Paraíba', 'rn': 'Rio Grande do Norte',
  'al': 'Alagoas', 'pi': 'Piauí', 'se': 'Sergipe', 'ro': 'Rondônia',
  'to': 'Tocantins', 'ac': 'Acre', 'ap': 'Amapá', 'rr': 'Roraima',
  'ms': 'Mato Grosso do Sul', 'mt': 'Mato Grosso', 'es': 'Espírito Santo',
  'df': 'Distrito Federal',
  'eua': 'Estados Unidos', 'usa': 'Estados Unidos', 'estados unidos': 'Estados Unidos',
  'espanha': 'Espanha', 'china': 'China', 'italia': 'Itália', 'itália': 'Itália',
  'frança': 'França', 'franca': 'França', 'alemanha': 'Alemanha',
  'inglaterra': 'Inglaterra', 'reino unido': 'Reino Unido', 'portugal': 'Portugal',
  'argentina': 'Argentina', 'méxico': 'México', 'mexico': 'México',
  'canadá': 'Canadá', 'canada': 'Canadá', 'japão': 'Japão', 'japao': 'Japão',
  'austrália': 'Austrália', 'australia': 'Austrália',
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
  'pensilvânia': 'Pensilvânia', 'pennsylvania': 'Pensilvânia',
  'carolina do sul': 'Carolina do Sul', 'south carolina': 'Carolina do Sul',
  'montana': 'Montana', 'mississippi': 'Mississippi',
  'alabama': 'Alabama', 'luisiana': 'Luisiana', 'louisiana': 'Luisiana',
  'massachusetts': 'Massachusetts',
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
  'angola': 'Angola', 'argélia': 'Argélia', 'áfrica do sul': 'África do Sul',
  'belgica': 'Bélgica', 'bélgica': 'Bélgica', 'bolívia': 'Bolívia',
  'bolivia': 'Bolívia', 'chile': 'Chile', 'colômbia': 'Colômbia',
  'colombia': 'Colômbia', 'coreia': 'Coreia do Sul', 'coréia': 'Coreia do Sul',
  'coreia do sul': 'Coreia do Sul', 'costa rica': 'Costa Rica', 'cuba': 'Cuba',
  'dinamarca': 'Dinamarca', 'egito': 'Egito', 'equador': 'Equador',
  'emirados árabes': 'Emirados Árabes Unidos', 'escócia': 'Escócia',
  'eslováquia': 'Eslováquia', 'eslovênia': 'Eslovênia', 'finlândia': 'Finlândia',
  'grécia': 'Grécia', 'holanda': 'Holanda', 'hungria': 'Hungria',
  'índia': 'Índia', 'indonésia': 'Indonésia', 'irlanda': 'Irlanda',
  'israel': 'Israel', 'marrocos': 'Marrocos', 'noruega': 'Noruega',
  'nova zelândia': 'Nova Zelândia', 'nova zelandia': 'Nova Zelândia',
  'países baixos': 'Países Baixos', 'polônia': 'Polônia', 'polonia': 'Polônia',
  'república tcheca': 'República Tcheca', 'romênia': 'Romênia',
  'rússia': 'Rússia', 'russia': 'Rússia', 'suécia': 'Suécia',
  'suica': 'Suíça', 'suíça': 'Suíça', 'tailândia': 'Tailândia',
  'tailandia': 'Tailândia', 'turquia': 'Turquia', 'ucrânia': 'Ucrânia',
  'uruguai': 'Uruguai', 'venezuela': 'Venezuela',
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
  'mundo': 'Brasil', 'mundo inteiro': 'Brasil', 'mundo todo': 'Brasil',
  'internacional': 'Brasil', 'global': 'Brasil',
};

const LOCATION_LOWER_WORDS = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na']);

function normalizeAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function dictLookup(loc: string): string | undefined {
  return LOCATION_DICTIONARY[loc] || LOCATION_DICTIONARY[normalizeAccents(loc)];
}

function cleanLocation(raw: string): string {
  let loc = raw.trim().toLowerCase();
  if (!loc) return '';
  loc = loc.replace(/^(em|no|na|nos|nas|em todo|em toda|in|at|en|el|la|le|a|an)\s+/i, '').trim();
  loc = loc.replace(/\(.*?\)/g, '').trim();
  loc = loc.replace(/,.*$/, '').trim();
  loc = loc.replace(/\s*-\s*[a-z0-9\s]+$/i, '').trim();
  return loc;
}

export function isBroadLocation(location: string): boolean {
  const loc = location.trim().toLowerCase();
  if (!loc) return false;
  if (/\bbrasil\b|\bbrazil\b/.test(loc)) return true;
  const exact = ['todos os estados', 'nacional', 'país inteiro', 'todo país', 'pais inteiro', 'todo estado'];
  if (exact.includes(loc)) return true;
  return false;
}

export function smartNormalizeQuery(keyword: string, location: string) {
  let cleanKw = keyword.trim().toLowerCase();
  let cleanLoc = cleanLocation(location);
  let dictResult = dictLookup(cleanLoc);
  if (!dictResult && cleanLoc.length >= 2) {
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
  const words = cleanKw.split(/\s+/);
  const correctedWords = words.map(word => {
    if (TYPO_DICTIONARY[word]) return TYPO_DICTIONARY[word];
    let bestMatch = word;
    let minDistance = 999;
    if (word.length >= 4) {
      for (const niche of COMMON_NICHES) {
        const dist = getLevenshteinDistance(word, niche);
        if (dist < minDistance) { minDistance = dist; bestMatch = niche; }
      }
      if (minDistance <= 2) return bestMatch;
    }
    return word;
  });
  cleanKw = correctedWords.join(' ');
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

export function extractDomain(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch { return null; }
}

export function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const NICHE_TO_OSM_TAGS: Record<string, string[]> = {
  'academia': ['amenity=gym', 'leisure=fitness_centre', 'sport=fitness', 'leisure=sports_centre', 'sport=swimming', 'sport=martial_arts', 'amenity=sports_centre', 'shop=sports'],
  'academy': ['amenity=gym', 'leisure=fitness_centre', 'sport=fitness', 'leisure=sports_centre', 'sport=swimming', 'sport=martial_arts', 'amenity=sports_centre'],
  'gym': ['amenity=gym', 'leisure=fitness_centre', 'sport=fitness', 'leisure=sports_centre'],
  'crossfit': ['leisure=fitness_centre', 'sport=crossfit', 'amenity=gym'],
  'pilates': ['leisure=fitness_centre', 'amenity=gym'],
  'personal trainer': ['leisure=fitness_centre', 'amenity=gym', 'sport=fitness'],
  'dentista': ['amenity=clinic', 'healthcare=dentist', 'healthcare:speciality=dentistry', 'dentist=yes'],
  'dentist': ['amenity=clinic', 'healthcare=dentist', 'healthcare:speciality=dentistry', 'dentist=yes'],
  'odontologia': ['amenity=clinic', 'healthcare=dentist', 'healthcare:speciality=dentistry'],
  'restaurante': ['amenity=restaurant', 'amenity=fast_food', 'amenity=bar', 'amenity=cafe'],
  'restaurant': ['amenity=restaurant', 'amenity=fast_food', 'amenity=bar', 'amenity=cafe'],
  'pizzaria': ['amenity=restaurant', 'cuisine=pizza'],
  'hamburgueria': ['amenity=fast_food', 'cuisine=burger'],
  'bar': ['amenity=bar', 'amenity=pub'],
  'cafe': ['amenity=cafe'],
  'cafeteria': ['amenity=cafe'],
  'advogado': ['office=lawyer', 'office=attorney', 'office=legal'],
  'lawyer': ['office=lawyer', 'office=attorney', 'office=legal'],
  'advocacia': ['office=lawyer', 'office=attorney', 'office=legal'],
  'medico': ['amenity=clinic', 'healthcare=doctor', 'healthcare=clinic', 'healthcare=hospital'],
  'doctor': ['amenity=clinic', 'healthcare=doctor', 'healthcare=clinic'],
  'clinica': ['amenity=clinic', 'healthcare=clinic', 'healthcare=doctor'],
  'estetica': ['shop=beauty', 'shop=hairdresser', 'beauty=cosmetics', 'shop=cosmetics', 'beauty=spa'],
  'salão de beleza': ['shop=hairdresser', 'shop=beauty', 'beauty=spa'],
  'beauty salon': ['shop=beauty', 'shop=hairdresser', 'beauty=spa'],
  'cabeleireiro': ['shop=hairdresser', 'shop=beauty'],
  'barbearia': ['shop=hairdresser', 'barber=yes'],
  'petshop': ['shop=pet', 'amenity=veterinary'],
  'pet shop': ['shop=pet', 'amenity=veterinary'],
  'veterinaria': ['amenity=veterinary'],
  'veterinário': ['amenity=veterinary'],
  'imobiliaria': ['office=estate_agent', 'shop=estate_agent'],
  'real estate': ['office=estate_agent', 'shop=estate_agent'],
  'contabilidade': ['office=accountant'],
  'accounting': ['office=accountant'],
  'engenheiro': ['office=engineer'],
  'engineer': ['office=engineer'],
  'arquiteto': ['office=architect'],
  'architect': ['office=architect'],
  'construtora': ['office=construction', 'craft=construction'],
  'construction': ['office=construction', 'craft=construction'],
  'oficina': ['shop=car_repair', 'shop=repair', 'craft=mechanic'],
  'auto repair': ['shop=car_repair', 'shop=repair', 'craft=mechanic'],
  'borracharia': ['shop=tyres', 'craft=tyre_repair'],
  'autopecas': ['shop=car_parts'],
  'auto parts': ['shop=car_parts'],
  'supermercado': ['shop=supermarket', 'shop=convenience'],
  'supermarket': ['shop=supermarket', 'shop=convenience'],
  'padaria': ['shop=bakery'],
  'bakery': ['shop=bakery'],
  'acougue': ['shop=butcher'],
  'butcher': ['shop=butcher'],
  'hortifruti': ['shop=greengrocer', 'shop=farm'],
  'farmácia': ['amenity=pharmacy'],
  'pharmacy': ['amenity=pharmacy'],
  'escola': ['amenity=school'],
  'school': ['amenity=school'],
  'creche': ['amenity=kindergarten'],
  'kindergarten': ['amenity=kindergarten'],
  'faculdade': ['amenity=university', 'amenity=college'],
  'university': ['amenity=university', 'amenity=college'],
  'hotel': ['tourism=hotel', 'tourism=hostel', 'tourism=motel', 'tourism=guest_house'],
  'pousada': ['tourism=guest_house', 'tourism=hotel', 'tourism=hostel'],
  'motel': ['tourism=motel'],
  'farmacia': ['amenity=pharmacy'],
};

export const NICHE_TO_CNAE: Record<string, string[]> = {
  'academia': ['9313-1/01', '9313-1/99'],
  'academy': ['9313-1/01', '9313-1/99'],
  'gym': ['9313-1/01', '9313-1/99'],
  'crossfit': ['9313-1/01'],
  'pilates': ['9313-1/01'],
  'personal trainer': ['9313-1/01'],
  'dentista': ['8630-5/01', '8630-5/02'],
  'dentist': ['8630-5/01', '8630-5/02'],
  'odontologia': ['8630-5/01', '8630-5/02'],
  'restaurante': ['5611-2/01', '5611-2/02', '5611-2/03'],
  'restaurant': ['5611-2/01', '5611-2/02', '5611-2/03'],
  'pizzaria': ['5611-2/03'],
  'hamburgueria': ['5611-2/02'],
  'bar': ['5611-2/04', '5611-2/05'],
  'cafe': ['5611-2/06'],
  'cafeteria': ['5611-2/06'],
  'advogado': ['6911-7/01', '6911-7/02'],
  'lawyer': ['6911-7/01', '6911-7/02'],
  'advocacia': ['6911-7/01', '6911-7/02'],
  'medico': ['8630-5/03', '8630-5/04', '8630-5/05', '8630-5/06', '8630-5/99'],
  'doctor': ['8630-5/03'],
  'clinica': ['8630-5/03', '8630-5/04', '8630-5/99', '8610-1/01'],
  'estetica': ['9602-5/01', '9602-5/02'],
  'salão de beleza': ['9602-5/01'],
  'beauty salon': ['9602-5/01'],
  'cabeleireiro': ['9602-5/01'],
  'barbearia': ['9602-5/01'],
  'petshop': ['4789-0/04', '4771-7/01'],
  'pet shop': ['4789-0/04', '4771-7/01'],
  'veterinaria': ['7500-1/00'],
  'veterinário': ['7500-1/00'],
  'imobiliaria': ['6821-8/01', '6821-8/02'],
  'real estate': ['6821-8/01', '6821-8/02'],
  'contabilidade': ['6920-6/01', '6920-6/02'],
  'accounting': ['6920-6/01', '6920-6/02'],
  'engenheiro': ['7112-0/00'],
  'engineer': ['7112-0/00'],
  'arquiteto': ['7111-1/00'],
  'architect': ['7111-1/00'],
  'construtora': ['4120-4/00', '4110-7/00'],
  'construction': ['4120-4/00', '4110-7/00'],
  'oficina': ['4520-0/01', '4520-0/02'],
  'auto repair': ['4520-0/01', '4520-0/02'],
  'borracharia': ['4520-0/03'],
  'autopecas': ['4530-7/01', '4530-7/02', '4530-7/03'],
  'auto parts': ['4530-7/01', '4530-7/02', '4530-7/03'],
  'supermercado': ['4711-3/01', '4711-3/02'],
  'supermarket': ['4711-3/01', '4711-3/02'],
  'padaria': ['4721-1/02'],
  'bakery': ['4721-1/02'],
  'acougue': ['4722-9/01'],
  'butcher': ['4722-9/01'],
  'hortifruti': ['4724-5/00'],
  'farmácia': ['4771-7/01'],
  'pharmacy': ['4771-7/01'],
  'farmacia': ['4771-7/01'],
  'escola': ['8511-2/00', '8512-1/00', '8513-9/00'],
  'school': ['8511-2/00', '8512-1/00', '8513-9/00'],
  'creche': ['8511-2/00'],
  'kindergarten': ['8511-2/00'],
  'faculdade': ['8531-7/00', '8532-5/00', '8533-3/00'],
  'university': ['8531-7/00', '8532-5/00', '8533-3/00'],
  'hotel': ['5510-8/01', '5510-8/02', '5510-8/03'],
  'pousada': ['5590-6/01'],
  'motel': ['5590-6/02'],
};

export function getCityBairros(location: string): string[] {
  const loc = location.trim();
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
  if (/belo\s+horizonte/i.test(loc)) {
    return [
      'Savassi', 'Lourdes', 'Funcionários', 'Mangabeiras', 'Serra',
      'Pampulha', 'Cidade Nova', 'Santa Tereza', 'Floresta', 'Santa Efigênia',
      'Buritis', 'Estoril', 'Castelo', 'Barreiro', 'Betânia',
    ];
  }
  if (/bras[ií]lia/i.test(loc)) {
    return [
      'Asa Sul', 'Asa Norte', 'Sudoeste', 'Octogonal', 'Lago Sul', 'Lago Norte',
      'Águas Claras', 'Taguatinga', 'Ceilândia', 'Guará', 'Samambaia',
    ];
  }
  if (/curitiba/i.test(loc)) {
    return [
      'Batel', 'Água Verde', 'Centro Cívico', 'Juvevê', 'Cabral',
      'Bigorrilho', 'Champagnat', 'Mossunguê', 'Portão', 'Santa Felicidade',
      'Boqueirão', 'Sítio Cercado', 'Bairro Alto', 'Jardim Social',
    ];
  }
  return [];
}

export const MAJOR_CITIES = [
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
  'Araçatuba, SP', 'Cotia, SP', 'Diadema, SP', 'Limeira, SP',
  'Mogi das Cruzes, SP', 'Osasco, SP', 'Praia Grande, SP', 'Suzano, SP',
  'Hortolândia, SP', 'Itu, SP', 'Jacareí, SP', 'Pindamonhangaba, SP',
  'Botucatu, SP', 'Bragança Paulista, SP', 'Ferraz de Vasconcelos, SP',
  'Itapevi, SP', 'Itapecerica da Serra, SP', 'Votuporanga, SP',
  'Ourinhos, SP', 'Rio Branco, AC', 'Macapá, AP', 'Porto Velho, RO',
  'Ji-Paraná, RO', 'Boa Vista, RR', 'Palmas, TO', 'Araguaína, TO',
  'Arapiraca, AL', 'Vitória da Conquista, BA', 'Ilhéus, BA',
  'Porto Seguro, BA', 'Juazeiro, BA', 'Juazeiro do Norte, CE',
  'Sobral, CE', 'Caucaia, CE', 'Serra, ES', 'Vitória, ES',
  'Cariacica, ES', 'Anápolis, GO', 'Aparecida de Goiânia, GO',
  'Rio Verde, GO', 'Imperatriz, MA', 'Contagem, MG', 'Uberaba, MG',
  'Montes Claros, MG', 'Governador Valadares, MG', 'Ipatinga, MG',
  'Divinópolis, MG', 'Dourados, MS', 'Três Lagoas, MS',
  'Várzea Grande, MT', 'Rondonópolis, MT', 'Sinop, MT',
  'Santarém, PA', 'Ananindeua, PA', 'Marabá, PA', 'Campina Grande, PB',
  'Patos, PB', 'Jaboatão dos Guararapes, PE', 'Paulista, PE',
  'Garanhuns, PE', 'Parnaíba, PI', 'Picos, PI', 'Foz do Iguaçu, PR',
  'Guarapuava, PR', 'Toledo, PR', 'Niterói, RJ', 'Duque de Caxias, RJ',
  'Campos dos Goytacazes, RJ', 'Volta Redonda, RJ', 'Angra dos Reis, RJ',
  'Mossoró, RN', 'Parnamirim, RN', 'Pelotas, RS', 'Santa Maria, RS',
  'Passo Fundo, RS', 'Novo Hamburgo, RS', 'Itajaí, SC', 'Chapecó, SC',
  'Criciúma, SC', 'Balneário Camboriú, SC', 'Nossa Senhora do Socorro, SE',
  'Lagarto, SE', 'Atibaia, SP', 'Itapetininga, SP', 'Registro, SP',
];

export function getNicheVariations(keyword: string): string[] {
  const kwLower = keyword.toLowerCase();
  const variants: Record<string, string[]> = {
    'academia': ['Personal Trainer', 'Crossfit', 'Centro de Treinamento', 'Musculação', 'Ginástica', 'Funcional', 'Pilates', 'Yoga'],
    'restaurante': ['Restaurante', 'Bar', 'Lanchonete', 'Pizzaria', 'Hamburgueria', 'Churrascaria', 'Comida Japonesa'],
    'dentista': ['Dentista', 'Odontologia', 'Implante Dentário', 'Clínica Odontológica', 'Ortodontia', 'Dentadura'],
    'advogado': ['Advogado', 'Escritório de Advocacia', 'Consultoria Jurídica', 'Direito', 'Advocacia'],
    'medico': ['Médico', 'Clínica', 'Consultório', 'Especialidade Médica', 'Clínica Médica'],
    'estetica': ['Estética', 'Salão de Beleza', 'Depilação', 'Massagem', 'Spa', 'Dermatologia Estética'],
    'petshop': ['Petshop', 'Veterinário', 'Banho e Tosa', 'Hotel para Cães', 'Rações', 'Pet'],
  };
  for (const [base, vars] of Object.entries(variants)) {
    if (kwLower.includes(base)) return [keyword, ...vars];
  }
  return [keyword];
}
