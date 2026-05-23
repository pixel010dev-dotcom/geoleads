import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server-auth';

export const runtime = 'nodejs';

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
  return lines.slice(1).map(line => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    values.push(current.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { if (values[i]) row[h] = values[i].replace(/""/g, '"'); });
    return row;
  });
}

function detectColumn(col: string): string | null {
  const map: [RegExp, string][] = [
    [/nome|empresa|razao|name|business|company/i, 'nome'],
    [/telefone|tel|phone|celular|cel|whatsapp|whats/i, 'telefone'],
    [/email|e-?mail|correio/i, 'email'],
    [/site|website|url|web|site/i, 'site'],
    [/instagram|insta|ig/i, 'instagram'],
    [/facebook|fb/i, 'facebook'],
    [/tiktok/i, 'tiktok'],
    [/cnpj|doc|cgc|cpf/i, 'cnpj'],
    [/cidade|city|city/i, 'cidade'],
    [/nicho|category|categoria|segmento|segment|ramo/i, 'nicho'],
    [/nota|avaliacao|rating|stars|avaliação|avaliacao/i, 'avaliacao'],
    [/endereco|address|endereço|logradouro/i, 'endereco'],
    [/bairro|neighborhood|distrito/i, 'bairro'],
    [/cep|postal|zip/i, 'cep'],
    [/estado|state|uf/i, 'estado'],
    [/tag|etiqueta|label/i, 'tags'],
  ];
  for (const [re, field] of map) {
    if (re.test(col)) return field;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });

    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) return NextResponse.json({ error: 'CSV vazio ou formato inválido' }, { status: 400 });

    const csvHeaders = Object.keys(rows[0]);
    const columnMap: Record<string, string> = {};
    for (const h of csvHeaders) {
      const detected = detectColumn(h);
      if (detected) columnMap[h] = detected;
    }

    const leads = rows.map(row => {
      const lead: Record<string, any> = {
        stage: 'Novo',
        notes: '',
        savedAt: new Date().toISOString(),
        tags: [],
      };
      for (const [csvCol, field] of Object.entries(columnMap)) {
        const value = row[csvCol]?.trim();
        if (!value) continue;
        if (field === 'tags') { lead.tags = value.split(/[;,|/]/).map((t: string) => t.trim()).filter(Boolean); }
        else lead[field] = value;
      }
      if (!lead.nome) lead.nome = 'Sem nome';
      if (!lead.telefone) lead.telefone = 'Não informado';
      if (!lead.nicho) lead.nicho = 'Geral';
      if (!lead.cidade) lead.cidade = 'Geral';
      return lead;
    });

    return NextResponse.json({
      success: true,
      leads,
      total: leads.length,
      columnMap,
      csvHeaders,
      unmappedColumns: csvHeaders.filter(h => !columnMap[h]),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao processar CSV' }, { status: 500 });
  }
}
