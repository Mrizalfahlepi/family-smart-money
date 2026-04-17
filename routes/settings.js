const express = require('express');
const router  = express.Router();
const db      = require('../database');

// ═══════════════════════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/settings
router.get('/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ success: true, data: settings });
  } catch (err) {
    console.error('[GET /settings]', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil pengaturan.' });
  }
});

// PUT /api/settings
router.put('/settings', (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ success: false, message: 'key dan value wajib diisi.' });

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
    res.json({ success: true, message: 'Pengaturan berhasil disimpan.' });
  } catch (err) {
    console.error('[PUT /settings]', err);
    res.status(500).json({ success: false, message: 'Gagal menyimpan pengaturan.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  MEMBERS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/members
router.get('/members', (req, res) => {
  try {
    const members = db.prepare('SELECT * FROM members WHERE is_active = 1 ORDER BY id ASC').all();
    res.json({ success: true, data: members });
  } catch (err) {
    console.error('[GET /members]', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil data anggota.' });
  }
});

// POST /api/members
router.post('/members', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Nama anggota wajib diisi.' });

    const activeCount = db.prepare("SELECT COUNT(*) as c FROM members WHERE is_active = 1").get().c;
    if (activeCount >= 6) return res.status(400).json({ success: false, message: 'Maksimal 6 anggota keluarga.' });

    const info = db.prepare('INSERT INTO members (name) VALUES (?)').run(name.trim());
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ success: true, data: member, message: 'Anggota berhasil ditambahkan.' });
  } catch (err) {
    console.error('[POST /members]', err);
    res.status(500).json({ success: false, message: 'Gagal menambahkan anggota.' });
  }
});

// DELETE /api/members/:id
router.delete('/members/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Anggota tidak ditemukan.' });

    db.prepare('UPDATE members SET is_active = 0 WHERE id = ?').run(id);
    res.json({ success: true, message: 'Anggota berhasil dihapus.' });
  } catch (err) {
    console.error('[DELETE /members/:id]', err);
    res.status(500).json({ success: false, message: 'Gagal menghapus anggota.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  BACKUP & RESTORE
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/backup — download semua data sebagai JSON
router.get('/backup', (req, res) => {
  try {
    const transactions = db.prepare('SELECT * FROM transactions').all();
    const categories   = db.prepare('SELECT * FROM categories').all();
    const settings     = db.prepare('SELECT * FROM settings').all();
    const members      = db.prepare('SELECT * FROM members').all();

    const backup = {
      version:    '1.0',
      created_at: new Date().toISOString(),
      app:        'Family Smart Money',
      data: { transactions, categories, settings, members }
    };

    const filename = `fsm-backup-${new Date().toISOString().slice(0,10)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(backup);
  } catch (err) {
    console.error('[GET /backup]', err);
    res.status(500).json({ success: false, message: 'Gagal membuat backup.' });
  }
});

// POST /api/restore — upload dan restore dari JSON
router.post('/restore', (req, res) => {
  try {
    const backup = req.body;
    if (!backup || !backup.data) return res.status(400).json({ success: false, message: 'Format backup tidak valid.' });

    const { transactions, categories, settings, members } = backup.data;

    db.exec('BEGIN');
    try {
      // Clear existing
      db.prepare('DELETE FROM transactions').run();
      db.prepare('DELETE FROM categories').run();
      db.prepare('DELETE FROM settings').run();
      db.prepare('DELETE FROM members').run();

      // Restore categories
      if (Array.isArray(categories)) {
        const stmt = db.prepare('INSERT OR IGNORE INTO categories (id,name,type,icon,is_default,is_active) VALUES (?,?,?,?,?,?)');
        categories.forEach(c => stmt.run(c.id, c.name, c.type, c.icon, c.is_default, c.is_active));
      }

      // Restore settings
      if (Array.isArray(settings)) {
        const stmt = db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)');
        settings.forEach(s => stmt.run(s.key, s.value));
      }

      // Restore members
      if (Array.isArray(members)) {
        const stmt = db.prepare('INSERT OR IGNORE INTO members (id,name,is_active) VALUES (?,?,?)');
        members.forEach(m => stmt.run(m.id, m.name, m.is_active));
      }

      // Restore transactions
      if (Array.isArray(transactions)) {
        const stmt = db.prepare('INSERT OR IGNORE INTO transactions (id,type,amount,category_id,description,recorded_by,date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)');
        transactions.forEach(t => stmt.run(t.id, t.type, t.amount, t.category_id, t.description, t.recorded_by, t.date, t.created_at, t.updated_at));
      }
      
      db.exec('COMMIT');
    } catch(e) {
      db.exec('ROLLBACK');
      throw e;
    }

    res.json({ success: true, message: 'Data berhasil direstore.' });
  } catch (err) {
    console.error('[POST /restore]', err);
    res.status(500).json({ success: false, message: 'Gagal merestore data.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  RESET
// ═══════════════════════════════════════════════════════════════════════════════

// DELETE /api/reset
router.delete('/reset', (req, res) => {
  try {
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM transactions').run();
      db.prepare('DELETE FROM members WHERE is_active = 1').run();
      // Reset sqlite autoincrement
      db.prepare("DELETE FROM sqlite_sequence WHERE name='transactions'").run();
      db.exec('COMMIT');
    } catch(e) {
      db.exec('ROLLBACK');
      throw e;
    }
    res.json({ success: true, message: 'Semua data berhasil direset.' });
  } catch (err) {
    console.error('[DELETE /reset]', err);
    res.status(500).json({ success: false, message: 'Gagal mereset data.' });
  }
});

module.exports = router;
