// billing.ts — limpo em auditoria 27/06/2026
// Funções removidas: reserveTokens, consumeReservation, refundReservation,
// getAvailableTokens, getActiveReservations, hasActiveReservation,
// getReservationByJobId, isJobDelivered, getDeliveryForJob,
// saveExtractionResults, getExtractionResults, deliverExtractionResults
// Motivo: nenhuma era importada; referenciam tabelas/RPCs inexistentes
// (token_reservations, extraction_deliveries, extraction_results)
// Débito real é feito via deduct_tokens RPC no extract/route.ts

export type BillingError = {
  error: string;
  status: number;
};

export function isBillingError<T>(r: T | BillingError): r is BillingError {
  return (r as BillingError).error !== undefined;
}
