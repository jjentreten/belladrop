/**
 * Pagou.ai — Webhook Handler
 * POST /.netlify/functions/webhook
 *
 * Pagou sends payment events here.
 * Deduplication: by top-level event `id` (in-memory; add Redis/DB for production persistence).
 * Fulfillment: only on `transaction.paid` event type.
 */

// In-memory deduplication (lasts for function instance lifetime).
// For cross-instance deduplication, replace with Redis SET NX or a DB upsert.
const processedEvents = new Set();

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  // Deduplicate by top-level event id
  const eventId = payload.id;
  if (!eventId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing event id' }) };
  }

  if (processedEvents.has(eventId)) {
    // Already processed — acknowledge without re-processing
    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, duplicate: true }),
    };
  }
  processedEvents.add(eventId);

  const transaction = payload.data;
  const eventType   = transaction?.event_type;

  switch (eventType) {
    case 'transaction.paid': {
      // TODO: Mark order as fulfilled in your database / send confirmation email
      console.log('Payment confirmed:', JSON.stringify({
        eventId,
        transactionId: transaction.id,
        externalRef:   transaction.correlation_id,
        method:        transaction.method,
        amount:        transaction.amount,
        paidAt:        transaction.paid_at,
      }));
      break;
    }

    case 'transaction.cancelled':
    case 'transaction.refunded':
    case 'transaction.partially_refunded':
    case 'transaction.chargedback': {
      // TODO: Handle reversals
      console.log(`Transaction ${eventType}:`, transaction?.id);
      break;
    }

    case 'transaction.three_ds_required': {
      // Handled on frontend via next_action — nothing server-side needed
      break;
    }

    default:
      // Unhandled event type — acknowledge anyway
      break;
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true }),
  };
};
