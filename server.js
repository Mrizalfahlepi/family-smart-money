require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// CORS headers (akses dari HP di jaringan yang sama)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────
const transactionsRouter = require('./routes/transactions');
const categoriesRouter = require('./routes/categories');
const settingsRouter = require('./routes/settings');
const authRouter = require('./routes/auth');
const aiRouter = require('./routes/ai');

app.use('/api/auth', authRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/ai', aiRouter);
app.use('/api', settingsRouter);   // handles /api/settings, /api/members, /api/backup, /api/restore, /api/reset

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', app: 'Family Smart Money', timestamp: new Date().toISOString() });
});

// SPA fallback — semua route non-API diarahkan ke index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
});

// ─── START SERVER & TELEGRAM ──────────────────────────────────────────────────
try {
  require('./telegram-bot')();
} catch (err) {
  console.error('[WARN] Modul Telegram gagal dimuat:', err.message);
}

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log('');
  console.log('====================================');
  console.log(' Family Smart Money - Server ON  ');
  console.log('====================================');
  console.log(` Port   : ${PORT}`);
  console.log(` Host   : ${HOST}`);
  console.log(` Access : http://localhost:${PORT}`);
  console.log(` GCP    : http://[EXTERNAL-IP]:${PORT}`);
  console.log('====================================');
  console.log('');
});
