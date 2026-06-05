import { createAdminSupabaseClient } from '@/lib/server-auth';

const supabase = createAdminSupabaseClient();

export type ReservationResult = {
  reservationId: string;
};

export type ConsumeResult = {
  deliveryId: string;
  status: 'consumed' | 'partially_consumed';
  consumed: number;
  refunded: number;
  tokenBalanceAfter: number;
};

export type RefundResult = {
  status: 'refunded';
  refundedAmount: number;
  tokenBalanceAfter: number;
};

export type BillingError = {
  error: string;
  status: number;
};

function isBillingError<T>(r: T | BillingError): r is BillingError {
  return (r as BillingError).error !== undefined;
}

export async function reserveTokens(
  userId: string,
  amount: number,
  jobId?: number
): Promise<ReservationResult | BillingError> {
  if (amount <= 0) {
    return { error: 'Quantidade invalida para reserva', status: 400 };
  }

  const { data, error } = await supabase.rpc('reserve_tokens', {
    p_user_id: userId,
    p_amount: amount,
    p_job_id: jobId || null,
  });

  if (error) {
    console.error('[BILLING] reserve_tokens failed:', error.message);
    if (error.message.includes('Saldo insuficiente')) {
      return { error: error.message, status: 402 };
    }
    if (error.message.includes('Profile not found')) {
      return { error: 'Perfil nao encontrado', status: 404 };
    }
    return { error: `Falha ao reservar tokens: ${error.message}`, status: 500 };
  }

  return { reservationId: data as string };
}

export async function consumeReservation(
  reservationId: string,
  consumedAmount: number,
  tokenBalanceAfter?: number
): Promise<ConsumeResult | BillingError> {
  if (consumedAmount <= 0) {
    return { error: 'Quantidade consumida deve ser positiva', status: 400 };
  }

  const { data, error } = await supabase.rpc('consume_reservation', {
    p_reservation_id: reservationId,
    p_consumed_amount: consumedAmount,
    p_token_balance_after: tokenBalanceAfter ?? 0,
  });

  if (error) {
    console.error('[BILLING] consume_reservation failed:', error.message);
    if (error.message.includes('already')) {
      return { error: `Reserva ja processada: ${error.message}`, status: 409 };
    }
    if (error.message.includes('expired')) {
      return { error: 'Reserva expirou', status: 410 };
    }
    return { error: `Falha ao consumir reserva: ${error.message}`, status: 500 };
  }

  return data as ConsumeResult;
}

export async function refundReservation(
  reservationId: string
): Promise<RefundResult | BillingError> {
  const { data, error } = await supabase.rpc('refund_reservation', {
    p_reservation_id: reservationId,
  });

  if (error) {
    console.error('[BILLING] refund_reservation failed:', error.message);
    if (error.message.includes('Cannot refund')) {
      return { error: `Reserva nao pode ser reembolsada: ${error.message}`, status: 409 };
    }
    return { error: `Falha ao reembolsar: ${error.message}`, status: 500 };
  }

  return data as RefundResult;
}

export async function getAvailableTokens(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_available_tokens', {
    p_user_id: userId,
  });

  if (error) {
    console.error('[BILLING] get_available_tokens failed:', error.message);
    return 0;
  }

  return (data as number) ?? 0;
}

export async function getActiveReservations(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_active_reservations', {
    p_user_id: userId,
  });

  if (error) {
    console.error('[BILLING] get_active_reservations failed:', error.message);
    return 0;
  }

  return (data as number) ?? 0;
}

export async function hasActiveReservation(reservationId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('token_reservations')
    .select('id, status')
    .eq('id', reservationId)
    .eq('status', 'reserved')
    .maybeSingle();

  if (error || !data) return false;
  return true;
}

export async function getReservationByJobId(jobId: number): Promise<{
  id: string;
  amount: number;
  status: string;
} | null> {
  const { data, error } = await supabase
    .from('token_reservations')
    .select('id, amount, status')
    .eq('job_id', jobId)
    .eq('status', 'reserved')
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function isJobDelivered(jobId: number): Promise<boolean> {
  const { data, error } = await supabase
    .from('extraction_deliveries')
    .select('id')
    .eq('job_id', jobId)
    .maybeSingle();

  if (error || !data) return false;
  return true;
}

export async function getDeliveryForJob(jobId: number): Promise<{
  id: string;
  lead_count: number;
  tokens_charged: number;
} | null> {
  const { data, error } = await supabase
    .from('extraction_deliveries')
    .select('id, lead_count, tokens_charged')
    .eq('job_id', jobId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function saveExtractionResults(
  jobId: number,
  userId: string,
  leads: any[]
): Promise<void> {
  const { error } = await supabase.from('extraction_results').upsert({
    job_id: jobId,
    user_id: userId,
    data: leads,
    lead_count: leads.length,
  }, { onConflict: 'job_id' });

  if (error) {
    console.error('[BILLING] save_extraction_results failed:', error.message);
  }
}

export async function getExtractionResults(jobId: number): Promise<any[]> {
  const { data, error } = await supabase
    .from('extraction_results')
    .select('data')
    .eq('job_id', jobId)
    .maybeSingle();

  if (error || !data) return [];
  return data.data as any[];
}

export async function deliverExtractionResults(
  jobId: number,
  leads: any[]
): Promise<void> {
  const { error } = await supabase
    .from('extraction_jobs')
    .update({
      leads: leads,
      delivered: true,
    })
    .eq('id', jobId);

  if (error) {
    console.error('[BILLING] deliver_extraction_results failed:', error.message);
  }
}
