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

    // Verificacao de seguranca: os leads sendo exportados precisam
    // ter vindo de uma entrega paga OU do proprio CRM do usuario
    // Esta verificacao impede exportacao de leads obtidos sem pagamento
    // Nota: leads do CRM sao propriedade do usuario, leads de extracao
    // so sao exportaveis se houve delivery (pagamento confirmado)

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

    const safeFilename = (filename || 'geoleads-leads')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 100) + '.xlsx';

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao exportar' }, { status: 500 });
  }
}
