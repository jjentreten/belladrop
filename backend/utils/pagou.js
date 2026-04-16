'use strict';

const { log, warn, error } = require('./logger');

const BASE_URLS = {
  production: 'https://api.pagou.ai',
  sandbox:    'https://api.sandbox.pagou.ai',
};

function getCredentials() {
  const apiKey = process.env.PAGOU_API_KEY || process.env.PAGOU_SECRET_KEY;
  const env    = process.env.PAGOU_ENVIRONMENT || 'sandbox';

  if (!apiKey) throw new Error('PAGOU_API_KEY não configurada no ambiente');

  if (env !== 'production' && apiKey.startsWith('sk_live_')) {
    warn('pagou', 'sk_live_ usada fora de production');
  }
  if (!apiKey.startsWith('sk_')) {
    warn('pagou', 'chave não começa com sk_ — pode ser chave pública');
  }

  const baseUrl = BASE_URLS[env] ?? BASE_URLS.sandbox;
  return { apiKey, env, baseUrl };
}

async function pagouRequest(method, path, body) {
  const { apiKey, baseUrl } = getCredentials();
  const url = `${baseUrl}${path}`;

  log('pagou', `${method} ${url}`);
  if (body) log('pagou', 'payload:', JSON.stringify(body));

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (err) {
    error('pagou', 'erro de rede:', err.message);
    throw Object.assign(new Error('Não foi possível alcançar a API Pagou'), {
      statusCode: 502,
      detail: err.message,
      host: baseUrl,
    });
  }

  const text = await res.text();
  log('pagou', `HTTP ${res.status}:`, text.slice(0, 400));

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const err = new Error(`Pagou retornou resposta não-JSON (HTTP ${res.status})`);
    err.statusCode = res.status;
    err.raw = text.slice(0, 300);
    throw err;
  }

  if (!res.ok) {
    error('pagou', 'erro da API:', JSON.stringify(data));
  }

  return { status: res.status, data };
}

module.exports = { pagouRequest, getCredentials };
