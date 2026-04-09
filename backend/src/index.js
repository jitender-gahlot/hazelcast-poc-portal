require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('./logger');
const authRoutes = require('./routes/auth');
const pocRoutes = require('./routes/pocs');

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
