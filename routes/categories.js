const express = require('express');
const router  = express.Router();
const db      = require('../database');

// ─── GET /api/categories ──────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { type } = req.query;
    const userId = req.user.id;
    let sql    = 'SELECT * FROM categories WHERE user_id = ? AND is_active = 1';
    const params = [userId];

    if (type) {
      if (type === 'income')  { sql += " AND type IN ('income', 'both')"; }
      if (type === 'expense') { sql += " AND type IN ('expense','both')"; }
    }

    sql += ' ORDER BY name ASC';
    const rows = db.prepare(sql).all(...params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[GET /categories]', err.message);
    res.status(500).json({ success: false, message: 'Gagal mengambil data kategori.' });
  }
});

// ─── POST /api/categories ─────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { name, type, icon } = req.body;
    const userId = req.user.id;
    if (!name || !type || !icon) return res.status(400).json({ success: false, message: 'name, type, dan icon wajib diisi.' });

    const stmt = db.prepare(`
      INSERT INTO categories (user_id, name, type, icon, is_default, is_active)
      VALUES (?, ?, ?, ?, 0, 1)
    `);
    const info = stmt.run(userId, name, type, icon);

    const newCat = db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ success: true, data: newCat, message: 'Kategori berhasil ditambahkan.' });
  } catch (err) {
    console.error('[POST /categories]', err.message);
    res.status(500).json({ success: false, message: 'Gagal menambah kategori.' });
  }
});

// ─── PUT /api/categories/:id ──────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, type, icon } = req.body;

    const existing = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(id, userId);
    if (!existing) return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan.' });

    const newName = name || existing.name;
    const newType = type || existing.type;
    const newIcon = icon || existing.icon;

    db.prepare(`
      UPDATE categories SET name=?, type=?, icon=?
      WHERE id=? AND user_id=?
    `).run(newName, newType, newIcon, id, userId);

    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    res.json({ success: true, data: updated, message: 'Kategori diperbarui.' });
  } catch (err) {
    console.error('[PUT /categories/:id]', err.message);
    res.status(500).json({ success: false, message: 'Gagal memperbarui kategori.' });
  }
});

module.exports = router;
