import { NextResponse } from 'next/server';

const cepCache = new Map<string, any>();
const CACHE_TTL = 60 * 60 * 1000;

export async function GET(request: Request, { params }: { params: Promise<{ cep: string }> }) {
  const { cep: raw } = await params;
  const cep = raw.replace(/\D/g, '');
  if (cep.length !== 8) return NextResponse.json({ error: 'CEP inválido' }, { status: 400 });

  const cached = cepCache.get(cep);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ success: true, data: cached.data });
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error('ViaCEP error');
    const data = await res.json();
    if (data.erro) return NextResponse.json({ error: 'CEP não encontrado' }, { status: 404 });

    cepCache.set(cep, { data, timestamp: Date.now() });
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro ao buscar CEP' }, { status: 500 });
  }
}
