const express = require('express');
const router  = express.Router();
const db      = require('../database');

// POST /api/auth/login — masuk atau daftar dengan nama + email
router.post('/login', (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !name.trim())   return res.status(400).json({ success: false, message: 'Nama wajib diisi.' });
    if (!email || !email.trim()) return res.status(400).json({ success: false, message: 'Email wajib diisi.' });

    // Validasi format email sederhana
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) return res.status(400).json({ success: false, message: 'Format email tidak valid.' });

    const cleanName  = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Cek apakah email sudah terdaftar
    const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);

    if (existing) {
      // Email sudah ada — cek apakah nama cocok
      if (existing.name.toLowerCase() !== cleanName.toLowerCase()) {
        return res.status(401).json({
          success: false,
          message: `Email ini terdaftar atas nama "${existing.name}". Nama yang Anda masukkan tidak cocok.`
        });
      }

      // Nama & email cocok — update last_login dan login
      db.prepare("UPDATE users SET last_login = datetime('now','localtime') WHERE id = ?").run(existing.id);
      const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id);

      return res.json({
        success: true,
        isNew:   false,
        message: `Selamat datang kembali, ${updated.name}!`,
        data:    updated,
      });
    }

    // Email belum ada — buat akun baru
    const info = db.prepare(`
      INSERT INTO users (name, email, last_login)
      VALUES (?, ?, datetime('now','localtime'))
    `).run(cleanName, cleanEmail);

    const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);

    return res.status(201).json({
      success: true,
      isNew:   true,
      message: `Akun berhasil dibuat. Selamat datang, ${newUser.name}!`,
      data:    newUser,
    });

  } catch (err) {
    console.error('[POST /auth/login]', err.message);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
});

// GET /api/auth/me — verifikasi user masih valid (by email)
router.get('/me', (req, res) => {
  try {
    const email = req.headers['x-user-email'];
    if (!email) return res.status(401).json({ success: false, message: 'Tidak terautentikasi.' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

    res.json({ success: true, data: user });
  } catch (err) {
    console.error('[GET /auth/me]', err.message);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
});

module.exports = router;
