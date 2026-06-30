import { NextResponse } from 'next/server';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorResponse(error: unknown, context?: string) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  const message = error instanceof Error ? error.message : 'Erro interno do servidor';
  const requestId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);

  console.error(`[API] ${context || 'unknown'}:`, message, { requestId });

  return NextResponse.json(
    { error: 'Erro interno do servidor', requestId },
    { status: 500 }
  );
}

export function withErrorHandler(
  handler: (req: Request, ...args: any[]) => Promise<NextResponse>,
  context?: string
) {
  return async (req: Request, ...args: any[]) => {
    try {
      return await handler(req, ...args);
    } catch (error) {
      return errorResponse(error, context);
    }
  };
}
