'use strict';

const express = require('express');
const router  = express.Router();
const { log, error } = require('../utils/logger');

/**
 * Deduplicação em memória (sobrevive enquanto o processo estiver rodando).
 * Para persistência entre reinicializações, substitua por Redis ou banco.
 * Exemplo Redis: await client.set(`webhook:${eventId}`, '1', { NX: true, EX: 86400 })
 */
const processedEvents = new Set();

// POST /api/webhook
router.post('/webhook', (req, res) => {
  const payload = req.body;

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Body inválido' });
  }

  const eventId = payload.id;
  if (!eventId) {
    return res.status(400).json({ error: 'Evento sem id' });
  }

  // Responde imediatamente para Pagou não repetir o envio
  res.status(200).json({ received: true, duplicate: processedEvents.has(eventId) });

  if (processedEvents.has(eventId)) return;
  processedEvents.add(eventId);

  // Limpa o Set periodicamente para não crescer indefinidamente
  if (processedEvents.size > 10000) processedEvents.clear();

  const transaction = payload.data;
  const eventType   = transaction?.event_type;

  switch (eventType) {
    case 'transaction.paid': {
      log('webhook', 'Pagamento confirmado:', JSON.stringify({
        eventId,
        transactionId: transaction.id,
        externalRef:   transaction.correlation_id,
        method:        transaction.method,
        amount:        transaction.amount,
        paidAt:        transaction.paid_at,
      }));
      // TODO: marcar pedido como pago no banco / enviar e-mail de confirmação
      break;
    }

    case 'transaction.cancelled':
    case 'transaction.refunded':
    case 'transaction.partially_refunded':
    case 'transaction.chargedback': {
      log('webhook', `Transação ${eventType}:`, transaction?.id);
      // TODO: tratar estornos
      break;
    }

    case 'transaction.three_ds_required': {
      // Tratado no frontend via next_action — nada server-side
      break;
    }

    default:
      log('webhook', 'Tipo de evento não tratado:', eventType);
  }
});

module.exports = router;
