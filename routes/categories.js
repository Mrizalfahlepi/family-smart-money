const express = require('express');
const router  = express.Router();
const db      = require('../database');

// ─── GET /api/categories ──────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { type } = req.query;
    let sql    = "SELECT * FROM categories WHERE is_active = 1";
    const params = [];

    if (type && type !== 'all') {
      sql += " AND (type = ? OR type = 'both')";
      params.push(type);
    }

    sql += ' ORDER BY is_default DESC, name ASC';
    const rows = db.prepare(sql).all(...params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[GET /categories]', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil kategori.' });
  }
});

// ─── POST /api/categories ─────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { name, type, icon } = req.body;
    if (!name || !type || !icon) return res.status(400).json({ success: false, message: 'name, type, dan icon wajib diisi.' });
    if (!['income','expense','both'].includes(type)) return res.status(400).json({ success: false, message: 'type harus income, expense, atau both.' });

    const stmt = db.prepare('INSERT INTO categories (name, type, icon, is_default) VALUES (?, ?, ?, 0)');
    const info = stmt.run(name.trim(), type, icon.trim());

    const newCat = db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ success: true, data: newCat, message: 'Kategori berhasil ditambahkan.' });
  } catch (err) {
    console.error('[POST /categories]', err);
    res.status(500).json({ success: false, message: 'Gagal menambahkan kategori.' });
  }
});

// ─── DELETE /api/categories/:id ──────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan.' });
    if (existing.is_default) return res.status(400).json({ success: false, message: 'Kategori default tidak bisa dihapus.' });

    // Soft delete
    db.prepare('UPDATE categories SET is_active = 0 WHERE id = ?').run(id);
    res.json({ success: true, message: 'Kategori berhasil dihapus.' });
  } catch (err) {
    console.error('[DELETE /categories/:id]', err);
    res.status(500).json({ success: false, message: 'Gagal menghapus kategori.' });
  }
});

module.exports = router;
