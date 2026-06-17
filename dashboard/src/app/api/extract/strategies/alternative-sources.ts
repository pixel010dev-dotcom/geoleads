import type { SearchLead } from '../lib/types';
import { createEmptySearchLead } from '../lib/types';

interface OsmBusiness {
  name: string;
  lat: string;
  lon: string;
  tags: Record<string, string>;
}

export async function extractFromOpenStreetMap(
  keyword: string,
  location: string,
  targetLimit: number,
  existingKeys: Set<string>
): Promise<SearchLead[]> {
  const leads: SearchLead[] = [];
  const seenNames = new Set<string>(Array.from(existingKeys));

  const knownBBoxes: Record<string, string> = {
    'rio de janeiro': '-43.795,-23.084,-43.088,-22.746',
    'são paulo': '-46.828,-23.751,-46.305,-23.410',
    'sao paulo': '-46.828,-23.751,-46.305,-23.410',
    'belo horizonte': '-44.064,-20.027,-43.838,-19.771',
    'brasília': '-48.087,-15.868,-47.685,-15.653',
    'brasilia': '-48.087,-15.868,-47.685,-15.653',
    'salvador': '-38.568,-13.089,-38.240,-12.818',
    'fortaleza': '-38.648,-3.910,-38.391,-3.688',
    'curitiba': '-49.397,-25.640,-49.155,-25.350',
    'recife': '-35.018,-8.167,-34.820,-7.982',
    'porto alegre': '-51.327,-30.211,-51.020,-29.952',
    'manaus': '-60.067,-3.208,-59.786,-2.995',
    'belém': '-48.547,-1.488,-48.365,-1.228',
    'belem': '-48.547,-1.488,-48.365,-1.228',
    'goiânia': '-49.375,-16.803,-49.147,-16.565',
    'goiania': '-49.375,-16.803,-49.147,-16.565',
    'guarulhos': '-46.607,-23.527,-46.419,-23.366',
    'campinas': '-47.173,-23.042,-46.931,-22.787',
  };

  let bbox = knownBBoxes[location.toLowerCase()];
  if (!bbox) {
    for (const [name, box] of Object.entries(knownBBoxes)) {
      if (location.toLowerCase().includes(name)) { bbox = box; break; }
    }
  }
  if (!bbox) return leads;

  const amenityTypes = [
    'restaurant', 'cafe', 'bar', 'pub', 'fast_food',
    'dentist', 'clinic', 'hospital', 'pharmacy',
    'school', 'kindergarten', 'university',
    'supermarket', 'convenience', 'bakery',
    'hotel', 'hostel', 'motel',
    'gym', 'sports_centre', 'swimming_pool',
    'bank', 'atm', 'post_office',
    'car_repair', 'car_wash', 'car_dealer',
    'hair_dresser', 'beauty_salon',
    'pet_shop', 'veterinary',
  ];

  for (const amenity of amenityTypes) {
    if (leads.length >= targetLimit) break;

    try {
      const query = encodeURIComponent(`[out:json][timeout:10];
        nwr[amenity="${amenity}"](${bbox});
        out body;`);

      const response = await fetch(`https://overpass-api.de/api/interpreter?data=${query}`, {
        headers: { 'User-Agent': 'GeoLeads/1.0' },
        signal: AbortSignal.timeout(12000),
      });

      if (!response.ok) continue;
      const data = await response.json();
      const elements: OsmBusiness[] = data.elements || [];

      for (const el of elements) {
        if (leads.length >= targetLimit) break;
        const name = el.tags?.name || el.tags?.['name:pt'] || '';
        if (!name || seenNames.has(name.toLowerCase())) continue;
        seenNames.add(name.toLowerCase());

        const lead = createEmptySearchLead();
        lead.nome = name;
        lead.categoria = el.tags?.amenity || '';
        lead.endereco = [el.tags?.['addr:street'], el.tags?.['addr:housenumber'], el.tags?.['addr:city']]
          .filter(Boolean).join(', ');
        lead.cep = el.tags?.['addr:postcode'] || '';
        if (el.tags?.phone) {
          lead.telefone = el.tags.phone;
        }
        if (el.tags?.website) {
          lead.site = el.tags.website;
        }
        leads.push(lead);
      }

      await new Promise(r => setTimeout(r, 300));
    } catch {}
  }

  return leads;
}

export async function extractFromBrasilApi(
  cnpj: string
): Promise<{ razao_social: string; telefone: string; email: string; logradouro: string; bairro: string; municipio: string; uf: string; cep: string } | null> {
  try {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return null;

    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      headers: { 'User-Agent': 'GeoLeads/1.0' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
