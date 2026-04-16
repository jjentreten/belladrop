'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const transactionsRouter = require('./routes/transactions');
const webhookRouter      = require('./routes/webhook');
const utmifyRouter       = require('./routes/utmify');
const { log, error }     = require('./utils/logger');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Body parsing ──────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Segurança com Helmet ──────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy:       false, // front-end estático servido pelo nginx
  crossOriginEmbedderPolicy:   false,
}));

// ── CORS: só permite o domínio do front ──────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Permite requisições sem origin (mobile apps, curl, testes locais)
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    cb(new Error(`CORS bloqueado: origem não permitida (${origin})`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Logging HTTP ──────────────────────────────────────────────────
app.use(morgan('combined'));

// ── Rate limiting global ──────────────────────────────────────────
app.use('/api', rateLimit({
  windowMs: 60 * 1000,   // 1 minuto
  max:      60,           // 60 req/min por IP
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Muitas requisições. Tente novamente em breve.' },
}));

// Rate limit mais restrito para criação de transações
app.use('/api/create-transaction', rateLimit({
  windowMs: 60 * 1000,
  max:      10,
  message: { error: 'Limite de criação de transações atingido. Aguarde 1 minuto.' },
}));

// ── Rotas API ─────────────────────────────────────────────────────
app.use('/api', transactionsRouter);
app.use('/api', webhookRouter);
app.use('/api', utmifyRouter);

// ── Health check ──────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'development', ts: new Date().toISOString() });
});

// ── Front-end estático (pasta pai do backend) ─────────────────────
// Em produção o nginx serve os estáticos; aqui serve para dev local.
app.use(express.static(path.join(__dirname, '..')));

// ── 404 ───────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// ── Error handler global ─────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  error('app', err.message);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Erro interno' });
});

// ── Start ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  log('app', `Servidor rodando na porta ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  log('app', `Origens CORS permitidas: ${allowedOrigins.join(', ') || '(todas — defina CORS_ORIGINS em prod)'}`);
});

module.exports = app;
