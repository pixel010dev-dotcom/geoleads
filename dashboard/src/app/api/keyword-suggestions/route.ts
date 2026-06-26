import { NextResponse } from 'next/server';

const EXPANSIONS: Record<string, string[]> = {
  academia: ['academia', 'academias', 'personal trainer', 'musculação', 'crossfit', 'pilates', 'ginástica', 'funcional', 'fitness', 'nutrição esportiva'],
  restaurante: ['restaurante', 'restaurantes', 'pizzaria', 'churrascaria', 'comida japonesa', 'comida italiana', 'comida mexicana', 'self-service', 'lanchonete', 'bar', 'petiscaria'],
  advogado: ['advogado', 'advocacia', 'escritório de advocacia', 'consultoria jurídica', 'direito civil', 'direito trabalhista'],
  medico: ['médico', 'clínica médica', 'consultório', 'pediatra', 'cardiologista', 'dermatologista', 'ortopedista'],
  dentista: ['dentista', 'clínica dentária', 'odontologia', 'implante dentário', 'ortodontia', 'clareamento dental'],
  mercado: ['mercado', 'supermercado', 'mercearia', 'quitanda', 'açougue', 'padaria', 'hortifruti'],
  salao: ['salão de beleza', 'cabeleireiro', 'barbearia', 'manicure', 'estética', 'depilação', 'maquiagem'],
  oficina: ['oficina mecânica', 'borracharia', 'funilaria', 'auto elétrica', 'revisão veicular', 'troca de óleo'],
  hotel: ['hotel', 'pousada', 'resort', 'hostel', 'flat', 'motel', 'hospedagem'],
  escola: ['escola', 'colégio', 'curso', 'cursinho', 'pré-vestibular', 'ensino médio', 'educação infantil'],
};

export async function POST(request: Request) {
  try {
    const { keyword } = await request.json();
    if (!keyword || typeof keyword !== 'string') {
      return NextResponse.json({ error: 'Keyword é obrigatória' }, { status: 400 });
    }

    const kw = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const suggestions = EXPANSIONS[kw] || [keyword, `${keyword}s`];

    return NextResponse.json({ success: true, suggestions });
  } catch {
    return NextResponse.json({ error: 'Erro ao gerar sugestões' }, { status: 500 });
  }
}
