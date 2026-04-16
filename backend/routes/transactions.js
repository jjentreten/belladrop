'use strict';

const express = require('express');
const router  = express.Router();
const { pagouRequest } = require('../utils/pagou');
const { log, warn } = require('../utils/logger');

// POST /api/create-transaction
router.post('/create-transaction', async (req, res) => {
  const { method, external_ref, amount, buyer, token, installments, products } = req.body || {};

  if (!method || !external_ref || !amount || !buyer) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes: method, external_ref, amount, buyer' });
  }

  // Monta lista de produtos
  const productList = Array.isArray(products) && products.length
    ? products
    : [{ name: 'Pedido BELLARIO', price: amount, quantity: 1, tangible: true }];

  const productsTotal = productList.reduce((s, p) => s + (p.price * (p.quantity || 1)), 0);
  if (Math.abs(productsTotal - amount) > 1) {
    warn('create-transaction', `amount (${amount}) difere do total dos produtos (${productsTotal})`);
  }

  // notify_url aponta para o novo endpoint Express
  const siteUrl   = process.env.SITE_URL || '';
  const notifyUrl = siteUrl && !siteUrl.includes('localhost')
    ? `${siteUrl}/api/webhook`
    : undefined;

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

  try {
    const { status, data } = await pagouRequest('POST', '/v2/transactions', payload);
    return res.status(status).json(data);
  } catch (err) {
    log('create-transaction', 'erro:', err.message);
    return res.status(err.statusCode || 500).json({
      error: err.message,
      ...(err.detail ? { detail: err.detail } : {}),
      ...(err.raw    ? { raw:    err.raw    } : {}),
    });
  }
});

// GET /api/get-transaction?id=<id>
router.get('/get-transaction', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Parâmetro id ausente' });

  // Sanitiza: só aceita caracteres alfanuméricos e hífens
  if (!/^[\w-]+$/.test(id)) {
    return res.status(400).json({ error: 'id inválido' });
  }

  try {
    const { status, data } = await pagouRequest('GET', `/v2/transactions/${encodeURIComponent(id)}`);
    return res.status(status).json(data);
  } catch (err) {
    log('get-transaction', 'erro:', err.message);
    return res.status(err.statusCode || 500).json({
      error: err.message,
      ...(err.raw ? { raw: err.raw } : {}),
    });
  }
});

module.exports = router;
