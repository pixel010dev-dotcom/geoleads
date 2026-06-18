import type { SearchLead } from '../lib/types';
import { createEmptySearchLead } from '../lib/types';
import { normalizePhone } from '../lib/validation';
import { NICHE_TO_OSM_TAGS, NICHE_TO_CNAE } from '../lib/normalizers';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

const GEO_CACHE = new Map<string, { bbox: string; lat: number; lon: number }>();
const CNPJ_CACHE = new Map<string, any>();

const STATE_CODES_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

function extractCityState(location: string): { city: string; state: string } {
  const loc = location.trim();
  const stateMatch = loc.match(/,?\s*([A-Z]{2})$/);
  const state = stateMatch ? stateMatch[1].toUpperCase() : '';
  const city = stateMatch ? loc.replace(/,?\s*[A-Z]{2}$/, '').trim() : loc;
  return { city, state };
}

async function geocodeLocation(location: string): Promise<{ bbox: string; lat: number; lon: number } | null> {
  const cacheKey = location.toLowerCase();
  const cached = GEO_CACHE.get(cacheKey);
  if (cached) return cached;

  try {
    const { city, state } = extractCityState(location);
    const q = state ? `${city}, ${state}, Brazil` : `${city}, Brazil`;
    const url = `${NOMINATIM_URL}/search?q=${encodeURIComponent(q)}&format=json&limit=1&accept-language=pt`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'GeoLeads/1.0 (geo@geoleads.app)' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.length === 0) return null;

    const place = data[0];
    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);
    if (isNaN(lat) || isNaN(lon)) return null;

    const bboxRaw: string[] = place.boundingbox || [];
    if (bboxRaw.length >= 4) {
      const bbox = `${bboxRaw[2]},${bboxRaw[0]},${bboxRaw[3]},${bboxRaw[1]}`;
      const result = { bbox, lat, lon };
      GEO_CACHE.set(cacheKey, result);
      return result;
    }

    const padding = 0.05;
    const bbox = `${lon - padding},${lat - padding},${lon + padding},${lat + padding}`;
    const result = { bbox, lat, lon };
    GEO_CACHE.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

async function runOverpass(query: string, timeoutMs = 15000): Promise<any[]> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(`${OVERPASS_URL}?data=${encoded}`, {
      headers: { 'User-Agent': 'GeoLeads/1.0' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.elements || [];
  } catch {
    return [];
  }
}

function osmElementToLead(el: any): SearchLead | null {
  const tags = el.tags || {};
  const name = tags.name || tags['name:pt'] || '';
  if (!name || name.length < 2 || name.length > 200) return null;

  const lead = createEmptySearchLead();
  lead.nome = name;

  const catTag = tags.amenity || tags.shop || tags.office || tags.craft || tags.leisure || tags.tourism || tags.healthcare || '';
  lead.categoria = catTag;

  const street = tags['addr:street'] || '';
  const number = tags['addr:housenumber'] || '';
  const neighborhood = tags['addr:suburb'] || tags['addr:district'] || '';
  const city = tags['addr:city'] || '';
  const state = tags['addr:state'] || '';
  lead.endereco = [street, number, neighborhood].filter(Boolean).join(', ');
  if (city) lead.endereco += `${lead.endereco ? ', ' : ''}${city}`;
  if (state && !lead.endereco.includes(state)) lead.endereco += ` - ${state}`;
  lead.cep = tags['addr:postcode'] || '';

  if (tags.phone) {
    lead.telefone = normalizePhone(tags.phone);
  }

  if (tags.website) {
    const ws = tags.website.startsWith('http') ? tags.website : `https://${tags.website}`;
    lead.site = ws;
  }

  if (tags.contact?.email) lead.email = tags['contact:email'] || '';
  if (tags.email && !lead.email) lead.email = tags.email;

  if (tags.contact?.instagram) lead.instagram = tags['contact:instagram'];
  if (tags.contact?.facebook) lead.facebook = tags['contact:facebook'];

  if (tags.opening_hours) lead.horarios = tags.opening_hours;

  if (tags.rating || tags['rating:average']) {
    lead.avaliacao = tags.rating || tags['rating:average'] || 'N/A';
  }

  if (el.lat && el.lon) {
    lead.placeUrl = `https://www.openstreetmap.org/?mlat=${el.lat}&mlon=${el.lon}`;
  }

  return lead;
}

function matchKeywordToKeyword(keyword: string, osmName: string, osmTags: Record<string, string>): boolean {
  const kw = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const name = osmName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (name.includes(kw)) return true;
  const tagValues = Object.values(osmTags).join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (tagValues.includes(kw)) return true;
  return false;
}

export async function extractFromOpenStreetMap(
  keyword: string,
  location: string,
  targetLimit: number,
  existingKeys: Set<string>
): Promise<SearchLead[]> {
  const leads: SearchLead[] = [];
  const seenNames = new Set<string>(Array.from(existingKeys).map(k => k.toLowerCase()));

  const geo = await geocodeLocation(location);
  if (!geo) return leads;

  const kwLower = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const osmTags = NICHE_TO_OSM_TAGS[kwLower] || [];

  const kwParts = kwLower.split(/\s+/);
  let baseKeyword: string | null = null;
  for (const part of kwParts) {
    if (NICHE_TO_OSM_TAGS[part]) { baseKeyword = part; break; }
  }

  const allQueries: string[] = [];

  if (osmTags.length > 0) {
    for (const tag of osmTags) {
      const [key, value] = tag.split('=');
      if (key && value) {
        allQueries.push(`[out:json][timeout:15];nwr["${key}"="${value}"](${geo.bbox});out body;`);
      }
    }
  }

  allQueries.push(`[out:json][timeout:15];nwr[name~"${kwLower}",i](${geo.bbox});out body;`);

  const wildcardTags = ['amenity', 'shop', 'office', 'craft', 'leisure', 'tourism', 'healthcare'];
  allQueries.push(`[out:json][timeout:15];nwr[~"^(amenity|shop|office|craft|leisure|tourism|healthcare)$"~"."](${geo.bbox});out body;`);

  const results: any[] = [];

  for (const query of allQueries) {
    if (leads.length >= targetLimit) break;
    const elements = await runOverpass(query, 15000);
    results.push(...elements);
    await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
  }

  const seenElementIds = new Set<number>();

  for (const el of results) {
    if (leads.length >= targetLimit) break;
    if (seenElementIds.has(el.id)) continue;
    seenElementIds.add(el.id);

    const tags = el.tags || {};

    let matches = false;

    if (baseKeyword) {
      const relevantTags = NICHE_TO_OSM_TAGS[baseKeyword] || [];
      for (const tag of relevantTags) {
        const [key, value] = tag.split('=');
        if (tags[key] === value) { matches = true; break; }
      }
    }

    if (!matches) {
      for (const tagCat of wildcardTags) {
        if (tags[tagCat]) { matches = true; break; }
      }
    }

    if (!matches) continue;
    if (!tags.name && !tags['name:pt']) continue;

    const lead = osmElementToLead(el);
    if (!lead) continue;

    if (seenNames.has(lead.nome.toLowerCase())) continue;

    if (!matchKeywordToKeyword(keyword, lead.nome, tags)) {
      if (!baseKeyword && !tags.amenity && !tags.shop && !tags.office && !tags.craft && !tags.leisure) continue;
    }

    seenNames.add(lead.nome.toLowerCase());
    leads.push(lead);
  }

  return leads;
}

export async function extractFromBrasilApiCNPJ(
  cnpj: string
): Promise<{ razao_social: string; telefone: string; email: string; logradouro: string; bairro: string; municipio: string; uf: string; cep: string } | null> {
  try {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return null;

    if (CNPJ_CACHE.has(cleanCnpj)) return CNPJ_CACHE.get(cleanCnpj) || null;

    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      headers: { 'User-Agent': 'GeoLeads/1.0' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;
    const data = await response.json();
    CNPJ_CACHE.set(cleanCnpj, data);
    return data;
  } catch {
    return null;
  }
}

export function enrichLeadFromBrasilApi(lead: SearchLead, brasilData: any): SearchLead {
  if (brasilData.telefone && (lead.telefone === 'Não informado' || !lead.telefone)) {
    lead.telefone = normalizePhone(String(brasilData.telefone));
  }
  if (brasilData.email && !lead.email) {
    lead.email = brasilData.email;
  }
  if (!lead.cnpj && brasilData.cnpj) {
    lead.cnpj = brasilData.cnpj;
  }
  if (!lead.endereco) {
    const parts = [brasilData.logradouro, brasilData.bairro, brasilData.municipio, brasilData.uf].filter(Boolean);
    if (parts.length > 0) lead.endereco = parts.join(', ');
  }
  if (!lead.cep && brasilData.cep) {
    lead.cep = brasilData.cep;
  }
  return lead;
}

function cnaeToBrasilApi(cnae: string): string {
  return cnae.replace(/\//g, '').replace(/-/g, '');
}

const CNAE_API_CACHE = new Map<string, any[]>();

function extractBrasilApiListUrl(cnae: string, city: string, state: string): string {
  const cnaeClean = cnaeToBrasilApi(cnae);
  const cityEnc = encodeURIComponent(city);
  return `https://brasilapi.com.br/api/cnpj/v1/${cnaeClean}?municipio=${cityEnc}&uf=${state}`;
}

export async function searchByCnaeAndCity(
  keyword: string,
  location: string,
  targetLimit: number,
  existingKeys: Set<string>
): Promise<SearchLead[]> {
  const leads: SearchLead[] = [];
  const seenNames = new Set<string>(Array.from(existingKeys).map(k => k.toLowerCase()));

  const kwLower = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const kwParts = kwLower.split(/\s+/);
  let cnaeCodes: string[] = [];

  for (const part of kwParts) {
    if (NICHE_TO_CNAE[part]) {
      cnaeCodes = NICHE_TO_CNAE[part];
      break;
    }
  }

  if (cnaeCodes.length === 0) return leads;

  const { city, state } = extractCityState(location);
  if (!city || !state) return leads;

  for (const cnae of cnaeCodes) {
    if (leads.length >= targetLimit) break;

    try {
      const url = extractBrasilApiListUrl(cnae, city, state);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'GeoLeads/1.0' },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) continue;
      const companies = await res.json();
      if (!Array.isArray(companies)) continue;

      for (const company of companies) {
        if (leads.length >= targetLimit) break;

        const name = company.nome_fantasia || company.razao_social || '';
        if (!name || seenNames.has(name.toLowerCase())) continue;
        seenNames.add(name.toLowerCase());

        const fullData = await extractFromBrasilApiCNPJ(company.cnpj);
        if (!fullData) continue;

        const lead = createEmptySearchLead();
        lead.nome = name;
        lead.cnpj = company.cnpj || '';
        if (fullData.telefone) lead.telefone = normalizePhone(String(fullData.telefone));
        if (fullData.email) lead.email = fullData.email;
        const addrParts = [fullData.logradouro, fullData.bairro, fullData.municipio, fullData.uf].filter(Boolean);
        if (addrParts.length > 0) lead.endereco = addrParts.join(', ');
        if (fullData.cep) lead.cep = fullData.cep;

        const nomeLower = name.toLowerCase();
        const keywordMatch = kwParts.some(part => nomeLower.includes(part));
        if (!keywordMatch) continue;
        leads.push(lead);

        await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
      }

      await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
    } catch {}
  }

  return leads;
}
