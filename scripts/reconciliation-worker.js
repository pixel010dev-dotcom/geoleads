/**
 * Reconciliation Worker for GeoLeads Billing System
 *
 * This script reconciles:
 * 1. Expired token reservations (refunds tokens)
 * 2. Orphan extraction jobs (jobs in 'running' status for too long)
 *
 * Run via cron: every 15 minutes
 * Can also be called via API endpoint
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function reconcileExpiredReservations() {
  console.log('🔄 Reconciling expired reservations...');

  const { data, error } = await supabase.rpc('reconcile_expired_reservations');

  if (error) {
    console.error('❌ reconcile_expired_reservations failed:', error.message);
    return 0;
  }

  console.log(`✅ ${data} expired reservations reconciled`);
  return data || 0;
}

async function reconcileOrphanJobs() {
  console.log('🔄 Reconciling orphan jobs...');

  const maxJobDurationMs = 2 * 60 * 60 * 1000; // 2 hours
  const cutoffTime = new Date(Date.now() - maxJobDurationMs).toISOString();

  // Find jobs running for too long
  const { data: orphanJobs, error: findError } = await supabase
    .from('extraction_jobs')
    .select('id, reservation_id, user_id, started_at')
    .eq('status', 'running')
    .lt('started_at', cutoffTime);

  if (findError) {
    console.error('❌ Failed to find orphan jobs:', findError.message);
    return 0;
  }

  if (!orphanJobs || orphanJobs.length === 0) {
    console.log('✅ No orphan jobs found');
    return 0;
  }

  console.log(`🔄 Found ${orphanJobs.length} orphan jobs`);

  let reconciled = 0;
  for (const job of orphanJobs) {
    // Refund reservation if exists
    if (job.reservation_id) {
      const { error: refundError } = await supabase.rpc('refund_reservation', {
        p_reservation_id: job.reservation_id
      });

      if (refundError) {
        console.error(`❌ Failed to refund reservation ${job.reservation_id}:`, refundError.message);
        continue;
      }
    }

    // Mark job as failed
    const { error: updateError } = await supabase
      .from('extraction_jobs')
      .update({
        status: 'failed',
        error: 'Job orfao - tempo maximo excedido. Tokens reembolsados.',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    if (updateError) {
      console.error(`❌ Failed to update orphan job ${job.id}:`, updateError.message);
      continue;
    }

    reconciled++;
    console.log(`✅ Orphan job ${job.id} reconciled - reservation refunded`);
  }

  console.log(`✅ ${reconciled}/${orphanJobs.length} orphan jobs reconciled`);
  return reconciled;
}

async function main() {
  console.log('='.repeat(50));
  console.log('🔧 RECONCILIATION WORKER STARTED');
  console.log(`📅 ${new Date().toISOString()}`);
  console.log('='.repeat(50));

  const expiredCount = await reconcileExpiredReservations();
  const orphanCount = await reconcileOrphanJobs();

  console.log('='.repeat(50));
  console.log(`📊 Summary: ${expiredCount} expired reservations + ${orphanCount} orphan jobs`);
  console.log('✅ RECONCILIATION WORKER COMPLETED');
  console.log('='.repeat(50));
}

main().catch(err => {
  console.error('❌ Reconciliation worker failed:', err);
  process.exit(1);
});
