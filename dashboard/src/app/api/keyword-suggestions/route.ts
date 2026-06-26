import { NextResponse } from 'next/server';

const EXPANSIONS: Record<string, string[]> = {
  academia: ['academia', 'academias', 'personal trainer', 'musculação', 'crossfit', 'pilates', 'ginástica', 'funcional', 'fitness', 'nutrição esportiva'],
  restaurante: ['restaurante', 'restaurantes', 'pizzaria', 'churrascaria', 'comida japonesa', 'comida italiana', 'comida mexicana', 'self-service', 'lanchonete', 'bar', 'petiscaria', 'espetinho', 'sushi', 'hamburgueria'],
  advogado: ['advogado', 'advocacia', 'escritório de advocacia', 'consultoria jurídica', 'direito civil', 'direito trabalhista', 'advocacia previdenciária', 'direito imobiliário'],
  medico: ['médico', 'clínica médica', 'consultório', 'pediatra', 'cardiologista', 'dermatologista', 'ortopedista', 'clínico geral', 'ginecologista', 'oftalmologista', 'otorrino', 'neurologista', 'endocrinologista'],
  dentista: ['dentista', 'clínica dentária', 'odontologia', 'implante dentário', 'ortodontia', 'clareamento dental', 'dentista estético', 'aparelho dentário'],
  mercado: ['mercado', 'supermercado', 'mercearia', 'quitanda', 'açougue', 'padaria', 'hortifruti', 'verdureira', 'sacolão', 'atacadista'],
  salao: ['salão de beleza', 'cabeleireiro', 'barbearia', 'manicure', 'estética', 'depilação', 'maquiagem', 'sobrancelha', 'cílios', 'unhas', 'podologia'],
  oficina: ['oficina mecânica', 'borracharia', 'funilaria', 'auto elétrica', 'revisão veicular', 'troca de óleo', 'centro automotivo', 'mecânico', 'suspensão', 'escapamento'],
  hotel: ['hotel', 'pousada', 'resort', 'hostel', 'flat', 'motel', 'hospedagem', 'inn', 'suítes'],
  escola: ['escola', 'colégio', 'curso', 'cursinho', 'pré-vestibular', 'ensino médio', 'educação infantil', 'berçário', 'reforço escolar', 'escola particular', 'escola bilíngue'],
  construtora: ['construtora', 'empreiteira', 'incorporadora', 'construção civil', 'reforma', 'projetos', 'arquitetura', 'engenharia civil'],
  autoescola: ['autoescola', 'auto escola', 'centro de formação', 'carteira de motorista', 'direção defensiva', 'CNH'],
  pet: ['pet shop', 'veterinário', 'clínica veterinária', 'banho e tosa', 'hotel pet', 'ração', 'pet care', 'creche pet'],
  farmacia: ['farmácia', 'drograria', 'farmácia de manipulação', 'produtos farmacêuticos', 'medicamentos', 'farmácia popular'],
  contador: ['contador', 'escritório de contabilidade', 'contabilidade', 'consultoria contábil', 'departamento pessoal', 'gestão fiscal'],
  imobiliaria: ['imobiliária', 'corretor', 'imóveis', 'aluguel', 'venda de imóveis', 'administração de condomínio', 'consultoria imobiliária'],
  clinica: ['clínica', 'clínica médica', 'clínica de saúde', 'centro médico', 'diagnóstico', 'exames', 'ultrassom', 'radiologia', 'laboratório'],
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
