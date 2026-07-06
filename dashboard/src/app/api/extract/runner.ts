import type { SearchLead } from './lib/types';
import { extractFromGooglePlaces, type PlacesApiResult } from './strategies/google-places';

export interface RunnerResult {
  leads: SearchLead[];
  scanned: number;
  citiesDone: number;
  totalTimeMs: number;
  error?: string;
}

export interface RunnerConfig {
  keyword: string;
  location: string;
  targetLimit: number;
  filterRule: string;
  isBroadRegion: boolean;
  existingLeadKeys: string[];
  onProgress?: (leads: SearchLead[], scanned: number, citiesDone: number, message: string) => void;
  onDone?: (result: RunnerResult) => void | Promise<void>;
  shouldCancel?: () => Promise<boolean>;
  maxTimeMs?: number;
}

/** Converte resultado da Places API para SearchLead */
function placeToLead(r: PlacesApiResult): SearchLead {
  return {
    nome: r.nome,
    telefone: r.telefone,
    site: r.site || '',
    endereco: r.endereco,
    avaliacao: r.avaliacao,
    reviewCount: String(r.reviewCount || ''),
    categoria: r.categoria,
    placeUrl: r.placeUrl,
    horarios: '',
    cep: '',
    email: '',
    instagram: '',
    facebook: '',
    tiktok: '',
    linkedin: '',
    cnpj: '',
  };
}

/** Remove duplicatas por nome */
function dedup(leads: SearchLead[]): SearchLead[] {
  const seen = new Set<string>();
  return leads.filter(l => {
    const key = l.nome.toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Remove leads óbvios que não são negócios */
function isJunk(nome: string): boolean {
  const n = nome.toLowerCase();
  if (n.length < 3) return true;
  if (/^(road|street|avenue|map|search|login|home|about|contact)/i.test(n)) return true;
  if (/^\d+$/.test(n)) return true;
  if (/\.(com|net|org|gov)\b/.test(n)) return true;
  return false;
}

export async function runExtraction(config: RunnerConfig): Promise<SearchLead[]> {
  const { keyword, location, targetLimit, existingLeadKeys, onProgress, onDone, shouldCancel } = config;

  const startTime = Date.now();
  const MAX_TOTAL_MS = 60000; // 60 segundos máximo
  let finalized = false;

  const notify = (msg: string) => {
    if (onProgress) onProgress([], 0, 0, msg);
  };

  const finalize = async (leads: SearchLead[], error?: string) => {
    if (finalized) return leads;
    finalized = true;

    if (onDone) {
      try {
        await onDone({
          leads,
          scanned: leads.length,
          citiesDone: 1,
          totalTimeMs: Date.now() - startTime,
          error,
        });
      } catch (e: any) {
        console.error('[RUNNER] onDone error:', e?.message || e);
      }
    }
    return leads;
  };

  try {
    notify(`Buscando "${keyword}" em ${location}...`);

    // ==========================================
    // GOOGLE PLACES API — ÚNICA ESTRATÉGIA
    // ==========================================
    const placesResults = await extractFromGooglePlaces(keyword, location, targetLimit);

    if (placesResults.length === 0) {
      console.log(`[RUNNER] Places API retornou 0 resultados`);
      return await finalize([], 'Nenhum resultado encontrado');
    }

    // Converte e limpa
    let leads = placesResults.map(placeToLead);
    leads = dedup(leads);
    leads = leads.filter(l => !isJunk(l.nome));

    // Remove leads que já existem
    const existingNames = new Set(existingLeadKeys.map(k => k.split('|')[0].toLowerCase()));
    leads = leads.filter(l => !existingNames.has(l.nome.toLowerCase()));

    // Limita ao solicitado
    leads = leads.slice(0, targetLimit);

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[RUNNER] ${leads.length} leads em ${elapsed}s`);

    return await finalize(leads);

  } catch (err: any) {
    console.error('[RUNNER] Erro fatal:', err);
    return await finalize([], err?.message || 'Erro na extração');
  }
}
