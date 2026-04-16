'use strict';

const express = require('express');
const router  = express.Router();
const { log, error } = require('../utils/logger');

const UTMIFY_ENDPOINT = 'https://api.utmify.com.br/api-credentials/orders';

// ── Helpers (portados das funções Netlify originais) ──────────────

function pad2(n) { return String(n).padStart(2, '0'); }

function formatDateTime(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function toNullableString(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value);
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatUtmifyPayload(order) {
  const trackingIn   = order?.trackingParameters || {};
  const commissionIn = order?.commission || {};

  const totalPriceInCents  = Math.round(toNumber(commissionIn.totalPriceInCents, 0));
  const gatewayFeeInCents  = Math.round(toNumber(commissionIn.gatewayFeeInCents, 0));

  let userCommissionInCents = commissionIn.userCommissionInCents;
  if (userCommissionInCents === undefined || userCommissionInCents === null || userCommissionInCents === '') {
    userCommissionInCents = commissionIn.userValueInCents ?? totalPriceInCents;
  }

  return {
    orderId:       toNullableString(order?.orderId) || `order-${Date.now()}`,
    platform:      toNullableString(order?.platform) || 'other',
    paymentMethod: toNullableString(order?.paymentMethod) || 'pix',
    status:        toNullableString(order?.status) || 'waiting_payment',
    createdAt:     formatDateTime(order?.createdAt || new Date()),
    approvedDate:  formatDateTime(order?.approvedDate),
    refundedAt:    formatDateTime(order?.refundedAt),
    customer: {
      name:     toNullableString(order?.customer?.name) || '',
      email:    toNullableString(order?.customer?.email) || '',
      phone:    toNullableString(order?.customer?.phone),
      document: toNullableString(order?.customer?.document),
    },
    products: Array.isArray(order?.products) ? order.products.map((p) => ({
      id:           toNullableString(p?.id) || 'produto',
      name:         toNullableString(p?.name) || 'Produto',
      planId:       toNullableString(p?.planId),
      planName:     toNullableString(p?.planName),
      quantity:     Math.max(1, Math.round(toNumber(p?.quantity, 1))),
      priceInCents: Math.max(0, Math.round(toNumber(p?.priceInCents, 0))),
    })) : [],
    trackingParameters: {
      src:          toNullableString(trackingIn.src),
      sck:          toNullableString(trackingIn.sck),
      utm_source:   toNullableString(trackingIn.utm_source   ?? trackingIn.utmSource),
      utm_campaign: toNullableString(trackingIn.utm_campaign ?? trackingIn.utmCampaign),
      utm_medium:   toNullableString(trackingIn.utm_medium   ?? trackingIn.utmMedium),
      utm_content:  toNullableString(trackingIn.utm_content  ?? trackingIn.utmContent),
      utm_term:     toNullableString(trackingIn.utm_term     ?? trackingIn.utmTerm),
    },
    commission: {
      totalPriceInCents,
      gatewayFeeInCents,
      userCommissionInCents: Math.round(toNumber(userCommissionInCents, totalPriceInCents)),
      ...(commissionIn.currency ? { currency: commissionIn.currency } : {}),
    },
    ...(order?.isTest !== undefined ? { isTest: !!order.isTest } : {}),
  };
}

// POST /api/notify-utmify
router.post('/notify-utmify', async (req, res) => {
  // SEGURANÇA: token vem obrigatoriamente do env, nunca hardcoded
  const utmifyToken = process.env.UTMIFY_API_TOKEN;
  if (!utmifyToken) {
    error('utmify', 'UTMIFY_API_TOKEN não configurado');
    return res.status(500).json({ error: 'UTMIFY_API_TOKEN não configurado no ambiente' });
  }

  const input   = req.body || {};
  const payload = formatUtmifyPayload(input);

  log('utmify', 'Pedido recebido:', JSON.stringify(input));
  log('utmify', 'Payload normalizado:', JSON.stringify(payload));

  try {
    const response = await fetch(UTMIFY_ENDPOINT, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token':  utmifyToken,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    log('utmify', `API response ${response.status}:`, text.slice(0, 500));

    // Repassa o status code original da UTMify ao front
    return res.status(response.status).type('json').send(text);
  } catch (err) {
    error('utmify', 'Erro de rede:', err.message);
    return res.status(502).json({ error: err.message });
  }
});

module.exports = router;
module.exports.formatUtmifyPayload = formatUtmifyPayload; // exporta para testes
