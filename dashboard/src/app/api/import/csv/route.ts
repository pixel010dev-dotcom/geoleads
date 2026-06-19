import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server-auth';

export const runtime = 'nodejs';

function splitCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; continue; }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === delimiter && !inQuotes) { values.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  values.push(current.trim());
  return values;
}

function detectDelimiter(firstLine: string): string {
  const quoteCount = (firstLine.match(/"/g) || []).length;
  const commas = firstLine.split(',').length - 1;
  const semicolons = firstLine.split(';').length - 1;
  const tabs = firstLine.split('\t').length - 1;
  if (commas >= semicolons && commas >= tabs) return ',';
  if (semicolons >= tabs) return ';';
  return '\t';
}

function parseCsv(text: string): { rows: Record<string, string>[]; delimiter: string } {
  let cleaned = text.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { rows: [], delimiter: ',' };
  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
  const rows = lines.slice(1).map(line => {
    const values = splitCsvLine(line, delimiter);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { if (values[i]) row[h] = values[i].replace(/""/g, '"'); });
    return row;
  });
  return { rows, delimiter };
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

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo muito grande (máx. 10MB)' }, { status: 400 });
    }

    const text = await file.text();
    const { rows, delimiter } = parseCsv(text);
    if (rows.length === 0) return NextResponse.json({ error: 'CSV vazio ou formato inválido. Verifique se o arquivo tem cabeçalho e pelo menos uma linha de dados.' }, { status: 400 });

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

    const unmappedColumns = csvHeaders.filter(h => !columnMap[h]);

    return NextResponse.json({
      success: true,
      leads,
      total: leads.length,
      columnMap,
      csvHeaders,
      delimiter,
      unmappedColumns,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro ao processar CSV' }, { status: 500 });
  }
}
