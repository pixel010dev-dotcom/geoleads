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
  'Maringá, PR', 'Blumenau, SC',
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
