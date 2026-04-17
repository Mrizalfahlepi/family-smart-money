const express = require('express');
const router  = express.Router();
const db      = require('../database');

// ─── GET /api/transactions ───────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { type, month, year, category_id, search } = req.query;
    const userId = req.user.id;

    let sql    = 'SELECT t.*, c.name AS category_name, c.icon AS category_icon FROM transactions t LEFT JOIN categories c ON t.category_id = c.id WHERE t.user_id = ?';
    const params = [userId];

    if (type)        { sql += " AND t.type = ?";         params.push(type); }
    if (month)       { sql += " AND strftime('%m', t.date) = ?"; params.push(String(month).padStart(2, '0')); }
    if (year)        { sql += " AND strftime('%Y', t.date) = ?"; params.push(String(year)); }
    if (category_id) { sql += " AND t.category_id = ?";  params.push(category_id); }
    if (search)      {
      sql += " AND (t.description LIKE ? OR t.recorded_by LIKE ? OR c.name LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    sql += ' ORDER BY t.date DESC, t.created_at DESC';

    const rows = db.prepare(sql).all(...params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[GET /transactions]', err.message);
    res.status(500).json({ success: false, message: 'Gagal mengambil data transaksi.' });
  }
});

// ─── GET /api/transactions/summary ──────────────────────────────────────────
router.get('/summary', (req, res) => {
  try {
    const { month, year } = req.query;
    const userId = req.user.id;
    const now = new Date();
    const m = String(month || now.getMonth() + 1).padStart(2, '0');
    const y = String(year  || now.getFullYear());

    const income  = db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE type='income'  AND user_id=? AND strftime('%m',date)=? AND strftime('%Y',date)=?").get(userId, m, y);
    const expense = db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE type='expense' AND user_id=? AND strftime('%m',date)=? AND strftime('%Y',date)=?").get(userId, m, y);

    res.json({
      success: true,
      data: {
        income:  income ? income.total : 0,
        expense: expense ? expense.total : 0,
        balance: (income ? income.total : 0) - (expense ? expense.total : 0),
        month: parseInt(m),
        year:  parseInt(y),
      }
    });
  } catch (err) {
    console.error('[GET /transactions/summary]', err.message);
    res.status(500).json({ success: false, message: 'Gagal mengambil ringkasan.' });
  }
});

// ─── GET /api/transactions/monthly ──────────────────────────────────────────
router.get('/monthly', (req, res) => {
  try {
    const months = Math.min(parseInt(req.query.months) || 6, 12);
    const userId = req.user.id;
    const result = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const y = String(d.getFullYear());

      const income  = db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE type='income'  AND user_id=? AND strftime('%m',date)=? AND strftime('%Y',date)=?").get(userId, m, y);
      const expense = db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE type='expense' AND user_id=? AND strftime('%m',date)=? AND strftime('%Y',date)=?").get(userId, m, y);

      const inc = income  ? income.total  : 0;
      const exp = expense ? expense.total : 0;

      result.push({
        month:   parseInt(m),
        year:    parseInt(y),
        label:   d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
        income:  inc,
        expense: exp,
        balance: inc - exp,
      });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[GET /transactions/monthly]', err.message);
    res.status(500).json({ success: false, message: 'Gagal mengambil data bulanan.' });
  }
});

// ─── GET /api/transactions/report ───────────────────────────────────────────
router.get('/report', (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const userId = req.user.id;
    if (!start_date || !end_date) return res.status(400).json({ success: false, message: 'start_date dan end_date diperlukan.' });

    const transactions = db.prepare(`
      SELECT t.*, c.name AS category_name, c.icon AS category_icon
      FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.date BETWEEN ? AND ?
      ORDER BY t.date DESC
    `).all(userId, start_date, end_date);

    const income  = transactions.filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    const catBreakdown = db.prepare(`
      SELECT c.name, c.icon, t.type,
             COUNT(*) AS count,
             SUM(t.amount) AS total
      FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.date BETWEEN ? AND ?
      GROUP BY t.category_id, t.type
      ORDER BY total DESC
    `).all(userId, start_date, end_date);

    res.json({
      success: true,
      data: {
        transactions,
        summary: { income, expense, balance: income - expense },
        category_breakdown: catBreakdown,
      }
    });
  } catch (err) {
    console.error('[GET /transactions/report]', err.message);
    res.status(500).json({ success: false, message: 'Gagal membuat laporan.' });
  }
});

// ─── POST /api/transactions ──────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { type, amount, category_id, description, recorded_by, date } = req.body;
    const userId = req.user.id;
    if (!type || !amount || !date) return res.status(400).json({ success: false, message: 'type, amount, dan date wajib diisi.' });
    if (!['income','expense'].includes(type)) return res.status(400).json({ success: false, message: 'type harus income atau expense.' });
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) return res.status(400).json({ success: false, message: 'amount harus angka positif.' });

    const stmt = db.prepare(`
      INSERT INTO transactions (user_id, type, amount, category_id, description, recorded_by, date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(userId, type, parseFloat(amount), category_id || null, description || '', recorded_by || '', date);

    const newTx = db.prepare('SELECT t.*, c.name AS category_name, c.icon AS category_icon FROM transactions t LEFT JOIN categories c ON t.category_id = c.id WHERE t.id = ?').get(info.lastInsertRowid);
    res.status(201).json({ success: true, data: newTx, message: 'Transaksi berhasil disimpan.' });
  } catch (err) {
    console.error('[POST /transactions]', err.message);
    res.status(500).json({ success: false, message: 'Gagal menyimpan transaksi.' });
  }
});

// ─── PUT /api/transactions/:id ───────────────────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const existing = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, userId);
    if (!existing) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });

    const { type, amount, category_id, description, recorded_by, date } = req.body;
    if (type && !['income','expense'].includes(type)) return res.status(400).json({ success: false, message: 'type harus income atau expense.' });

    const newType        = type        || existing.type;
    const newAmount      = amount      ? parseFloat(amount) : existing.amount;
    const newCategoryId  = category_id !== undefined ? (category_id || null) : existing.category_id;
    const newDescription = description !== undefined ? description : existing.description;
    const newRecordedBy  = recorded_by !== undefined ? recorded_by : existing.recorded_by;
    const newDate        = date        || existing.date;

    db.prepare(`
      UPDATE transactions SET type=?, amount=?, category_id=?, description=?, recorded_by=?, date=?,
      updated_at=datetime('now','localtime') WHERE id=? AND user_id=?
    `).run(newType, newAmount, newCategoryId, newDescription, newRecordedBy, newDate, id, userId);

    const updated = db.prepare('SELECT t.*, c.name AS category_name, c.icon AS category_icon FROM transactions t LEFT JOIN categories c ON t.category_id = c.id WHERE t.id = ?').get(id);
    res.json({ success: true, data: updated, message: 'Transaksi berhasil diperbarui.' });
  } catch (err) {
    console.error('[PUT /transactions/:id]', err.message);
    res.status(500).json({ success: false, message: 'Gagal memperbarui transaksi.' });
  }
});

// ─── DELETE /api/transactions/:id ────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const existing = db.prepare('SELECT id FROM transactions WHERE id = ? AND user_id = ?').get(id, userId);
    if (!existing) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });

    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    res.json({ success: true, message: 'Transaksi berhasil dihapus.' });
  } catch (err) {
    console.error('[DELETE /transactions/:id]', err.message);
    res.status(500).json({ success: false, message: 'Gagal menghapus transaksi.' });
  }
});

module.exports = router;
