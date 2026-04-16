/**
 * Pagou.ai — Create Transaction (PIX or Card)
 * POST /.netlify/functions/create-transaction
 *
 * Required env vars:
 *   PAGOU_API_KEY        — secret key (sk_sandbox_... or sk_live_...)
 *   PAGOU_ENVIRONMENT    — "sandbox" | "production"  (default: sandbox)
 *   SITE_URL             — public URL for notify_url (omit for local dev)
 */

'use strict';

const BASE_URLS = {
  production: 'https://api.pagou.ai',
  sandbox:    'https://api.sandbox.pagou.ai', // api-sandbox.pagou.ai does NOT resolve in public DNS
};

function maskKey(key) {
  if (!key || key.length < 12) return '[invalid]';
  return key.slice(0, 10) + '...' + key.slice(-4);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // ── Parse body ──────────────────────────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { method, external_ref, amount, buyer, token, installments, products } = body;

  // ── Validate required fields ─────────────────────────────────────
  if (!method || !external_ref || !amount || !buyer) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: method, external_ref, amount, buyer' }),
    };
  }

  // ── Credentials ──────────────────────────────────────────────────
  const apiKey = process.env.PAGOU_API_KEY || process.env.PAGOU_SECRET_KEY;
  if (!apiKey) {
    console.error('[create-transaction] PAGOU_API_KEY is not set');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'PAGOU_API_KEY not configured in environment' }),
    };
  }

  // ── Security: warn if live key is used outside production ────────
  const env = process.env.PAGOU_ENVIRONMENT || 'sandbox';
  if (env !== 'production' && apiKey.startsWith('sk_live_')) {
    console.warn('[create-transaction] WARNING: sk_live_ key used in non-production environment');
  }
  if (!apiKey.startsWith('sk_')) {
    console.warn('[create-transaction] WARNING: key does not start with sk_ — may be a public key');
  }

  const baseUrl = BASE_URLS[env] ?? BASE_URLS.sandbox;

  // ── Amount vs products consistency check ─────────────────────────
  const productList = (products && products.length)
    ? products
    : [{ name: 'Pedido BELLARIO', price: amount, quantity: 1, tangible: true }];

  const productsTotal = productList.reduce((s, p) => s + (p.price * (p.quantity || 1)), 0);
  if (Math.abs(productsTotal - amount) > 1) {
    // Log discrepancy but don't block — some gateways allow it (e.g. discounts)
    console.warn(
      `[create-transaction] amount (${amount}) differs from products total (${productsTotal}).`,
      'Consider aligning them to avoid 422 errors.'
    );
  }

  // ── Build payload ─────────────────────────────────────────────────
  const siteUrl   = process.env.SITE_URL || '';
  const notifyUrl = siteUrl && !siteUrl.includes('localhost')
    ? `${siteUrl}/.netlify/functions/webhook`
    : undefined; // skip notify_url in local dev — Pagou can't reach localhost

  const payload = {
    external_ref,
    amount,
    currency: 'BRL',
    method,
    buyer,
    ...(notifyUrl ? { notify_url: notifyUrl } : {}),
    products: productList,
    ...(method === 'credit_card' ? {
      token,
      installments: parseInt(installments) || 1,
    } : {}),
  };

  // ── Log (no secrets) ─────────────────────────────────────────────
  console.log('[create-transaction] env:', env);
  console.log('[create-transaction] key:', maskKey(apiKey));
  console.log('[create-transaction] endpoint:', `${baseUrl}/v2/transactions`);
  console.log('[create-transaction] payload:', JSON.stringify(payload, null, 2));

  // ── Call Pagou API ────────────────────────────────────────────────
  let res;
  try {
    res = await fetch(`${baseUrl}/v2/transactions`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        // Alternative if Bearer fails: 'apiKey': apiKey
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[create-transaction] network error:', err.name, err.message);
    console.error('[create-transaction] cause:', err.cause ?? 'none');
    return {
      statusCode: 502,
      body: JSON.stringify({
        error:   'Could not reach Pagou API',
        detail:  err.message,
        host:    baseUrl,
      }),
    };
  }

  // ── Parse response (safely — Pagou may return HTML on auth errors) ─
  const text = await res.text();
  console.log('[create-transaction] Pagou HTTP status:', res.status);
  console.log('[create-transaction] Pagou response:', text.slice(0, 600));

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      statusCode: res.status,
      body: JSON.stringify({
        error: `Pagou returned non-JSON (HTTP ${res.status})`,
        raw:   text.slice(0, 300),
      }),
    };
  }

  // ── Surface Pagou validation errors clearly ───────────────────────
  if (!res.ok) {
    console.error('[create-transaction] Pagou error:', JSON.stringify(data));
  }

  return {
    statusCode: res.status,
    headers: {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(data),
  };
};
