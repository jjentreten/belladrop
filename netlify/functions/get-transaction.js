/**
 * Pagou.ai — Get Transaction Status
 * GET /.netlify/functions/get-transaction?id=<transaction_id>
 *
 * Used by the frontend to poll PIX payment status.
 */

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const id = event.queryStringParameters?.id;
  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing transaction id' }) };
  }

  const secretKey = process.env.PAGOU_API_KEY || process.env.PAGOU_SECRET_KEY;
  const PAGOU_ENV  = process.env.PAGOU_ENVIRONMENT || 'sandbox';
  const PAGOU_BASE = PAGOU_ENV === 'production'
    ? 'https://api.pagou.ai'
    : 'https://api.sandbox.pagou.ai';

  try {
    const res = await fetch(`${PAGOU_BASE}/v2/transactions/${id}`, {
      headers: {
        'Authorization': `Bearer ${secretKey}`,
      },
    });

    const data = await res.json();

    return {
      statusCode: res.status,
      headers: {
        'Content-Type':                'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get transaction', details: err.message }),
    };
  }
};
