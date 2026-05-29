import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser, requireFeature } from '@/lib/server-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project-url.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
);

const CNPJ_REGEX = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/;

function normalizeCnpj(value: string) {
  return value.replace(/\D/g, '').slice(0, 14);
}

function formatCnpj(value: string) {
  const digits = normalizeCnpj(value);
  if (digits.length !== 14) return '';
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

async function fetchCnpjFromReceita(cnpj: string) {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { 'User-Agent': 'GeoLeads/1.0' },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      cnpj: formatCnpj(data.cnpj || cnpj),
      razao_social: data.razao_social || '',
      nome_fantasia: data.nome_fantasia || '',
      telefone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1}) ${data.telefone_1}` : '',
      email: '',
      endereco: data.logradouro ? `${data.logradouro}, ${data.numero} - ${data.bairro}` : '',
      cidade: data.municipio || '',
      uf: data.uf || '',
      cep: data.cep || '',
      situacao: data.situacao_cadastral || '',
      atividade_principal: data.descricao_tipo_de_logradouro || '',
      naturezas_juridica: data.natureza_juridica || '',
      data_abertura: data.data_inicio_atividade || '',
      site: '',
      instagram: '',
      facebook: '',
      tiktok: '',
      source: 'receita_federal',
      confidence_score: 95
    };
  } catch {
    return null;
  }
}

async function searchCnpjByName(name: string, city?: string) {
  try {
    const { data, error } = await supabase.rpc('search_cnpj_by_name', {
      search_name: name,
      search_city: city || null,
      limit_count: 3
    });
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });
    }

    if (!requireFeature(auth.planId, 'cnpjEnrichment')) {
      return NextResponse.json({ error: 'Enriquecimento de CNPJ exige plano Inicial ou superior.' }, { status: 403 });
    }

    const body = await request.json();
    const { cnpj, name, city } = body;

    if (cnpj) {
      const normalized = normalizeCnpj(cnpj);
      if (normalized.length !== 14) {
        return NextResponse.json({ error: 'CNPJ invalido.' }, { status: 400 });
      }

      const { data: existing } = await supabase
        .from('cnpj_companies')
        .select('*')
        .eq('cnpj', normalized)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ success: true, source: 'cache', data: existing });
      }

      const receitaData = await fetchCnpjFromReceita(normalized);
      if (receitaData) {
        await supabase.from('cnpj_companies').insert(receitaData);
        return NextResponse.json({ success: true, source: 'receita_federal', data: receitaData });
      }

      return NextResponse.json({ success: true, source: 'not_found', data: null });
    }

    if (name) {
      const results = await searchCnpjByName(name, city);
      return NextResponse.json({ success: true, source: 'database_search', data: results });
    }

    return NextResponse.json({ error: 'Informe CNPJ ou nome da empresa.' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    console.error('ERRO CNPJ ENRICH:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
