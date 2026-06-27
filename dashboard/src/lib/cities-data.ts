export interface CityInfo {
  name: string;
  state: string;
  slug: string;
  stateFull: string;
}

const STATE_MAP: Record<string, string> = {
  SP: 'São Paulo', RJ: 'Rio de Janeiro', MG: 'Minas Gerais', DF: 'Distrito Federal',
  BA: 'Bahia', CE: 'Ceará', PR: 'Paraná', AM: 'Amazonas', PE: 'Pernambuco',
  RS: 'Rio Grande do Sul', PA: 'Pará', GO: 'Goiás', MA: 'Maranhão',
  AL: 'Alagoas', RN: 'Rio Grande do Norte', MS: 'Mato Grosso do Sul',
  PI: 'Piauí', PB: 'Paraíba', MT: 'Mato Grosso', SC: 'Santa Catarina',
  SE: 'Sergipe', ES: 'Espírito Santo', RO: 'Rondônia', TO: 'Tocantins',
  AC: 'Acre', AP: 'Amapá', RR: 'Roraima',
};

function slugify(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const MAJOR_CITIES_RAW = [
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

export function parseCity(raw: string): CityInfo {
  const [name, state] = raw.split(', ').map(s => s.trim());
  return {
    name,
    state,
    slug: slugify(name),
    stateFull: STATE_MAP[state] || state,
  };
}

export const CITIES: CityInfo[] = MAJOR_CITIES_RAW.map(parseCity);

export function getCityBySlug(slug: string): CityInfo | undefined {
  return CITIES.find(c => c.slug === slug);
}

export const NICHE_EXAMPLES = [
  'advogado', 'dentista', 'academia', 'restaurante', 'pizzaria',
  'hamburgueria', 'sorveteria', 'confeitaria', 'cafeteria', 'estética',
  'salão de beleza', 'cabeleireiro', 'barbearia', 'imobiliária',
  'contabilidade', 'petshop', 'veterinária', 'oficina', 'médico',
  'psicólogo', 'nutricionista', 'fisioterapeuta', 'farmácia',
  'supermercado', 'padaria', 'escola', 'hotel', 'arquiteto',
  'engenheiro', 'construtora', 'fotografia', 'buffet',
];

export function getAllCitySlugs(): string[] {
  return CITIES.map(c => c.slug);
}

export interface NicheInfo {
  name: string;
  slug: string;
}

export function slugifyNiche(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const NICHES: NicheInfo[] = NICHE_EXAMPLES.map(n => ({
  name: n.charAt(0).toUpperCase() + n.slice(1),
  slug: slugifyNiche(n),
}));

export function getNicheBySlug(slug: string): NicheInfo | undefined {
  return NICHES.find(n => n.slug === slug);
}

export function getAllNicheSlugs(): string[] {
  return NICHES.map(n => n.slug);
}

export function getAllComboSlugs(): { nicho: string; cidade: string }[] {
  const result: { nicho: string; cidade: string }[] = [];
  for (const niche of NICHES) {
    for (const city of CITIES) {
      result.push({ nicho: niche.slug, cidade: city.slug });
    }
  }
  return result;
}
