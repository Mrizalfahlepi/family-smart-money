const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Secret JWT
// Pada skala produksi nyata, letakkan di .env. Untuk sekarang kita fallback ke literal.
const JWT_SECRET = process.env.JWT_SECRET || 'FSM_SUPER_SECRET_TENANT_KEY';

// Middleware Autentikasi untuk melindungi rute-rute API Client
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer <token>"

  if (!token) {
    return res.status(401).json({ success: false, message: 'Akses Ditolak. Harap Login terlebih dahulu.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Sesi kedaluwarsa atau token tidak valid.' });
    }
    // Setel req.user agar rute selanjutnya tahu siapa yang request
    req.user = user; 
    next();
  });
};

// ─── ENDPOINT: REGISTER ───────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, username, password } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ success: false, message: 'Mohon isi semua data (Nama, Username, Password).' });
  }

  try {
    // Cek apakah username sudah dipakai
    const existing = db.get("SELECT id FROM users WHERE username = ?", username);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username sudah digunakan oleh toko lain.' });
    }

    // Hash password demi keamanan
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = db.run(
      "INSERT INTO users (name, username, password) VALUES (?, ?, ?)",
      name, username, hashedPassword
    );

    // Otomatis bikin Kategori Bawaan untuk User Baru
    const defaultCategories = [
      { name: 'Gaji / Bisnis', type: 'income', icon: '💰' },
      { name: 'Makanan', type: 'expense', icon: '🍔' },
      { name: 'Transport', type: 'expense', icon: '🚗' },
      { name: 'Lainnya', type: 'both', icon: '📦' }
    ];

    const userId = result.lastInsertRowid;
    defaultCategories.forEach(cat => {
      db.run(
        "INSERT INTO categories (user_id, name, type, icon, is_default, is_active) VALUES (?, ?, ?, ?, 1, 1)",
        userId, cat.name, cat.type, cat.icon
      );
    });

    res.json({ success: true, message: 'Registrasi berhasil! Silakan login.' });
  } catch (error) {
    console.error('[AUTH ERROR]', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem.' });
  }
});

// ─── ENDPOINT: LOGIN ──────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username & Password wajib diisi.' });
  }

  try {
    const user = db.get("SELECT * FROM users WHERE username = ?", username);
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Username tidak ditemukan.' });
    }

    // Bandingkan password Hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Password salah!' });
    }

    // Update last login
    db.run("UPDATE users SET last_login = datetime('now','localtime') WHERE id = ?", user.id);

    // Buat JWT Token (Umur: 30 Hari)
    const tokenPayload = {
      id: user.id,
      name: user.name,
      username: user.username,
      telegram_chat_id: user.telegram_chat_id
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      success: true,
      token: token,
      user: {
        id: user.id,
        name: user.name,
        telegram_chat_id: user.telegram_chat_id
      }
    });

  } catch (error) {
    console.error('[AUTH ERROR]', error);
    res.status(500).json({ success: false, message: 'Gagal login karena error server.' });
  }
});

// ─── ENDPOINT: GET CURRENT USER INFO & UPDATE TELEGRAM ───────────────
router.get('/me', authenticateToken, (req, res) => {
  try {
    const user = db.get("SELECT id, name, username, telegram_chat_id FROM users WHERE id = ?", req.user.id);
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/link-telegram', authenticateToken, (req, res) => {
  const { telegram_chat_id } = req.body;
  if (!telegram_chat_id) return res.status(400).json({ success: false, message: 'Chat ID kosong.' });

  try {
    // Cek apakah dipakai user lain
    const existing = db.get("SELECT id FROM users WHERE telegram_chat_id = ? AND id != ?", telegram_chat_id, req.user.id);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Chat ID ini sudah ditautkan ke Toko/Akun lain!' });
    }

    db.run("UPDATE users SET telegram_chat_id = ? WHERE id = ?", telegram_chat_id, req.user.id);
    res.json({ success: true, message: 'Berhasil menautkan Bot Telegram!' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal menautkan Telegram.' });
  }
});

module.exports = {
  router,
  authenticateToken
};
