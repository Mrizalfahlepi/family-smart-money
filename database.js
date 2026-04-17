/**
 * database.js — Menggunakan node:sqlite built-in (Node.js >= 22.5)
 * Tidak memerlukan module eksternal atau kompilasi binary.
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs   = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'fsm.db');
const db = new DatabaseSync(dbPath);

// Enable WAL + foreign keys
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

// ─── SCHEMA ───────────────────────────────────────────────────────────────────

// ─── PENTING: MIGRASI SKEMA MULTI-TENANT ───────────────────────────────────────
// Karena sebelumnya SQLite belum memiliki kolom user_id, kita mencoba menambahkannya (Alter).
// Jika kolom sudah ada, exception akan ditangkap secara sunyi.
const addColumnSafe = (table, columnDef) => {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
  } catch (e) {
    // Abaikan jika kolom sudah ada
  }
};

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    username   TEXT UNIQUE,
    email      TEXT UNIQUE,
    password   TEXT NOT NULL DEFAULT '',
    telegram_chat_id TEXT UNIQUE,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    last_login TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL DEFAULT 1,
    type        TEXT NOT NULL CHECK(type IN ('income','expense')),
    amount      REAL NOT NULL,
    category_id INTEGER,
    description TEXT DEFAULT '',
    recorded_by TEXT DEFAULT '',
    date        TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    updated_at  TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL DEFAULT 1,
    name       TEXT NOT NULL,
    type       TEXT NOT NULL CHECK(type IN ('income','expense','both')),
    icon       TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    is_active  INTEGER DEFAULT 1,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key     TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    value   TEXT NOT NULL
  );
`);

// Eksekusi Patcher untuk Tabel Lama (Legacy Tables yang tidak punya kolom user_id)
addColumnSafe('users', "password TEXT NOT NULL DEFAULT ''");
addColumnSafe('users', "telegram_chat_id TEXT UNIQUE");
addColumnSafe('users', "username TEXT UNIQUE");
addColumnSafe('transactions', "user_id INTEGER NOT NULL DEFAULT 1");
addColumnSafe('categories', "user_id INTEGER NOT NULL DEFAULT 1");
addColumnSafe('settings', "user_id INTEGER NOT NULL DEFAULT 1");

// ─── HELPERS untuk COMPATIBILITY ─────────────────────────────────────────────
// node:sqlite API sedikit berbeda dari better-sqlite3, kita buat wrapper tipis

/**
 * Prepare & run query yang mengembalikan semua baris (SELECT).
 */
db.all = function(sql, ...params) {
  const stmt = this.prepare(sql);
  return stmt.all(...params);
};

/**
 * Prepare & run query yang mengembalikan satu baris (SELECT ... LIMIT 1).
 */
db.get = function(sql, ...params) {
  const stmt = this.prepare(sql);
  return stmt.get(...params);
};

/**
 * Prepare & run DML (INSERT/UPDATE/DELETE), returns info { lastInsertRowid, changes }.
 */
db.run = function(sql, ...params) {
  const stmt = this.prepare(sql);
  return stmt.run(...params);
};

// ─── SEED DATA ────────────────────────────────────────────────────────────────

function seedIfEmpty() {
  const catCount = db.get('SELECT COUNT(*) as c FROM categories').c;
  if (catCount > 0) return;

  // Default categories
  const incomeCategories = [
    ['Gaji',      'income',  'briefcase'],
    ['Bisnis',    'income',  'trending-up'],
    ['Investasi', 'income',  'bar-chart-2'],
    ['Hadiah',    'income',  'gift'],
    ['Lainnya',   'income',  'plus-circle'],
  ];

  const expenseCategories = [
    ['Makan',       'expense', 'utensils'],
    ['Transport',   'expense', 'car'],
    ['Belanja',     'expense', 'shopping-bag'],
    ['Tagihan',     'expense', 'file-text'],
    ['Kesehatan',   'expense', 'heart-pulse'],
    ['Pendidikan',  'expense', 'book-open'],
    ['Hiburan',     'expense', 'music'],
    ['Lainnya',     'expense', 'more-horizontal'],
  ];

  const allCats = [...incomeCategories, ...expenseCategories];
  allCats.forEach(([name, type, icon]) => {
    db.run('INSERT INTO categories (name, type, icon, is_default) VALUES (?, ?, ?, 1)', name, type, icon);
  });

  // Get category IDs
  const cats = db.all('SELECT id, name FROM categories');
  const catMap = {};
  cats.forEach(c => { catMap[c.name] = c.id; });

  // Default settings
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'family_name', 'Keluarga Kita');
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'currency', 'IDR');

  // Default members
  ['Ayah', 'Ibu', 'Anak'].forEach(name => db.run('INSERT INTO members (name) VALUES (?)', name));

  // Seed 15 realistic transactions
  const now       = new Date();
  const thisYear  = now.getFullYear();
  const thisMonth = now.getMonth() + 1;

  function dateStr(year, month, day) {
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  let prevMonth = thisMonth - 1, prevYear = thisYear;
  if (prevMonth < 1) { prevMonth = 12; prevYear -= 1; }

  let prev2Month = thisMonth - 2, prev2Year = thisYear;
  if (prev2Month < 1) { prev2Month = 12 + prev2Month; prev2Year -= 1; }
  if (prev2Month < 1) { prev2Month = 12 + prev2Month; prev2Year -= 1; }

  const seeds = [
    ['income',  5500000, catMap['Gaji'],       'Gaji bulanan Ayah',           'Ayah', dateStr(thisYear, thisMonth, 1)],
    ['income',  4200000, catMap['Gaji'],       'Gaji bulanan Ibu',            'Ibu',  dateStr(thisYear, thisMonth, 1)],
    ['expense', 1200000, catMap['Makan'],      'Belanja bulanan supermarket', 'Ibu',  dateStr(thisYear, thisMonth, 3)],
    ['expense',  350000, catMap['Transport'],  'Bensin dan toll minggu ini',  'Ayah', dateStr(thisYear, thisMonth, 5)],
    ['expense',  500000, catMap['Tagihan'],    'Listrik & air bulan ini',     'Ayah', dateStr(thisYear, thisMonth, 7)],
    ['income',   800000, catMap['Bisnis'],     'Hasil jualan online',         'Ibu',  dateStr(thisYear, thisMonth, 9)],
    ['expense',  250000, catMap['Kesehatan'],  'Vitamin & obat-obatan',       'Ibu',  dateStr(thisYear, thisMonth, 10)],
    ['expense',  150000, catMap['Hiburan'],    'Nonton bioskop keluarga',     'Ayah', dateStr(thisYear, thisMonth, 12)],
    ['expense',  450000, catMap['Pendidikan'], 'SPP sekolah anak',            'Ibu',  dateStr(thisYear, thisMonth, 14)],
    ['income',  5500000, catMap['Gaji'],       'Gaji bulanan Ayah',           'Ayah', dateStr(prevYear, prevMonth, 1)],
    ['income',  4200000, catMap['Gaji'],       'Gaji bulanan Ibu',            'Ibu',  dateStr(prevYear, prevMonth, 1)],
    ['expense',  980000, catMap['Belanja'],    'Pakaian anak semester baru',  'Ibu',  dateStr(prevYear, prevMonth, 8)],
    ['expense',  320000, catMap['Transport'],  'Bensin seminggu',             'Ayah', dateStr(prevYear, prevMonth, 15)],
    ['income',  5500000, catMap['Gaji'],       'Gaji bulanan Ayah',           'Ayah', dateStr(prev2Year, prev2Month, 1)],
    ['expense', 1500000, catMap['Makan'],      'Makan keluarga besar',        'Ayah', dateStr(prev2Year, prev2Month, 5)],
  ];

  seeds.forEach(([type, amount, category_id, description, recorded_by, date]) => {
    db.run(
      'INSERT INTO transactions (type, amount, category_id, description, recorded_by, date) VALUES (?, ?, ?, ?, ?, ?)',
      type, amount, category_id, description, recorded_by, date
    );
  });

  console.log('[DB] Seed data berhasil dimasukkan.');
}

seedIfEmpty();

module.exports = db;
