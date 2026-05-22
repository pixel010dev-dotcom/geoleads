import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server-auth';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { leads, filename } = await request.json();
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'Nenhum lead para exportar.' }, { status: 400 });
    }

    const rows = leads.map((l: any, i: number) => ({
      '#': i + 1,
      Nome: l.nome || '',
      Telefone: l.telefone || '',
      'Nota (0-5)': l.avaliacao || '',
      Site: l.site || '',
      Email: l.email || '',
      CNPJ: l.cnpj || '',
      Instagram: l.instagram || '',
      Facebook: l.facebook || '',
      TikTok: l.tiktok || '',
      Categoria: l.categoria || '',
      Endereço: l.endereco || '',
      Horários: l.horarios || '',
      CEP: l.cep || '',
      'Total Avaliações': l.reviewCount || '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    ws['!cols'] = Object.keys(rows[0]).map(() => ({ wch: 20 }));

    XLSX.utils.book_append_sheet(wb, ws, 'Leads');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename || 'geoleads-leads.xlsx'}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao exportar' }, { status: 500 });
  }
}
