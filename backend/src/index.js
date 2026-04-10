require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('./logger');
const authRoutes = require('./routes/auth');
const pocRoutes = require('./routes/pocs');

// ── Startup secret validation ─────────────────────────────────────
// Refuse to start with dangerously weak configuration.
const WEAK_VALUES = new Set(['changeme', 'secret', 'password', 'admin', 'SE2024', 'test', '']);
const fatal = (msg) => { logger.error(`STARTUP ABORT: ${msg}`); process.exit(1); };

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
  fatal('JWT_SECRET must be at least 32 characters. Generate one with: openssl rand -hex 32');

if (WEAK_VALUES.has(process.env.JWT_SECRET))
  fatal('JWT_SECRET is set to a known weak value. Set a strong random secret in .env');

if (!process.env.ADMIN_REGISTRATION_CODE || process.env.ADMIN_REGISTRATION_CODE.length < 12)
  fatal('ADMIN_REGISTRATION_CODE must be at least 12 characters to prevent brute-force.');

if (WEAK_VALUES.has(process.env.ADMIN_REGISTRATION_CODE))
  fatal('ADMIN_REGISTRATION_CODE is set to a known default (SE2024). Change it in .env');

if (!process.env.DATABASE_URL)
  fatal('DATABASE_URL is not set.');
// ─────────────────────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 3000;

// Trust the nginx reverse proxy
app.set('trust proxy', 1);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Structured request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('http', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      ms: Date.now() - start,
      ip: req.ip,
    });
  });
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/pocs', pocRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'poc-portal-api' });
});

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Unhandled errors
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`API server started on port ${PORT}`, { env: process.env.NODE_ENV });
});
