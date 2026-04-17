# BLUEPRINT ARSITEKTUR - FAMILY SMART MONEY 🌐🧠
*(Dokumen Master Teknis untuk Serah Terima AI di Masa Depan)*

Dokumen ini adalah *"BluePrint"* komprehensif tingkat tinggi yang dirancang khusus untuk dibaca oleh **AI Asisten** di masa depan. Jika Anda (Kawan AI) ditugaskan melanjutkan proyek ini, baca dokumen ini dengan seksama sebelum menyentuh kode apa pun!

---

## 1. TOPOLOGI & ARSITEKTUR UTAMA
Aplikasi ini tidak menggunakan kerangka modern (React/Next/Kubernates). Arsitekturnya difokuskan pada prinsip **"Super Cerdas tapi Sangat Ringan" (Lean & Smart)**.

- **Kategori**: Monolithic Single Page Application (SPA) + Telegram Daemon.
- **Frontend Utama**: Vanilla HTML, CSS Variables, dan ES12+ JavaScript (`public/app.js`). Routing halaman memakai trik *Hash-Routing* (`/#dashboard`) tanpa *reload*.
- **Backend Router**: Express.js. API berhulu di `/api/*`. Tidak ada Pustaka ORM (Object-Relational Mapping).
- **Mesin AI**: Google Gemini 2.5 Flash (`@google/generative-ai`), yang memonopoli perutean bahasa manusia & gambar (*Computer Vision*).
- **Proses Background (PM2)**: Server Node.js tidak hanya melayani HTTP Express, tapi juga memutar benang asinkron (*polling*) ke API Telegram melalui modul bawaan di dalam mesin yang sama.

---

## 2. ANATOMI DATABASE (NATIVE NODE:SQLITE)
**PERHATIAN KRITIS UNTUK AI SELANJUTNYA:**
Kami TIDAK memakai `better-sqlite3` karena sering gagal *build/compile* C++ di lingkungan virtual (VDS/Cloud). Kami mutlak memakai API bawaan node.js: `require('node:sqlite')`. 
- Pustaka `node:sqlite` **tidak** memiliki fungsi bawaan `db.transaction(() => {})`.
- Saat Anda (AI) menulis kode Bulk-Insert, WAJIB menggunakan pembungkus manual: `db.exec('BEGIN'); ... db.exec('COMMIT');`

### Skema Tabel Aktif (FSM.db):
1. **transactions**:
   - `id` (INTEGER PK)
   - `type` (TEXT 'income'/'expense')
   - `amount` (REAL)
   - `category_id` (INTEGER, Opsional)
   - `description` (TEXT)
   - `recorded_by` (TEXT, misal: 'User' / 'Telegram Bot' / 'WA Bot')
   - `date` (TEXT 'YYYY-MM-DD')
2. **categories**: `id, name, type, icon, is_default, is_active`.
3. **settings**: Key-Value minimal untuk konfigurasi umum.

---

## 3. ENGINE ARTIFICIAL INTELLIGENCE (GEMINI V2.5)
Integrasi Gemini berada pada titik `/routes/ai.js` (Untuk klien Web) dan `telegram-bot.js` (Untuk klien Mobile).

**A. Masalah Windows System Variables (WAJIB INGAT)**
Karena aplikasi dideploy di Windows Server GCP, pembacaan `process.env.GEMINI_API_KEY` sering nyangkut/tertipu memori lokal Windows. **Solusi Sakti**: File `.env` dibaca paksa secara I/O murni menggunakan `fs.readFileSync('.env')` dengan Regex saat AI diinisiasi. JANGAN hapus logika *bypass* ini atau "API Key Expired" akan terulang!

**B. Mode Prompting (JSON Strict Mode)**
Semua panggilan AI disetel menggunakan `generationConfig: { responseMimeType: "application/json" }`. AI "ditekan" dengan *zero-shot prompt* untuk merestrukturisasi kalimat acak menjadi *Array object* standar dengan properti baku: `type`, `amount`, dan `description`.

---

## 4. MESIN INTERAKTIF TELEGRAM (TELEGRAM-BOT.JS)
Ini adalah permata dari aplikasi ini. Bot berjalan atas mode *Long-Polling* (`bot.on('message')`).

**A. Skema Pembacaan Gambar (Vision)**
Jika `msg.photo` tertangkap, bot akan mengunduh gambar murni dari URL API internal Telegram, merubah array buffer ke *Base64*, lalu menyuntikkannya ke *InlineData* Gemini untuk parsing Struk Belanja Kasir secara optikal.

**B. Mekanika State Management (Interactive Keyboards)**
Sistem menolak meng-*insert* tebakan AI secara membabi buta.
1. Output AI disimpan sebentar di peta memori: `const pendingTransactions = new Map();` (Key: ID Obrolan unik).
2. Bot memaparkan draf ke layar user beserta merakit `reply_markup` berisi *Inline Keyboards*.
3. Event pendengar `bot.on('callback_query')` menangkap klik balasan.
   - `CONFIRM_YES` -> Eksekusi List di memori *Map* ke dalam SQLite. Map dihapus.
   - `CONFIRM_NO` -> Map dihancurkan tanpa jejak.

---

## 5. STRUKTUR DEPENDENSI & .ENV
**Package.json Requirements:**
- `express`, `multer` (Upload File Web)
- `node-telegram-bot-api` (Mesin Komunikasi Chatbot)
- `@google/generative-ai` (Nervous System)
- `dotenv` (Versi 16, versi bawah yang tidak me-*lock* caching enkripsi agar bypass kita jalan).

**Format .env Mutlak:**
```ini
GEMINI_API_KEY=AIzA...
TELEGRAM_BOT_TOKEN=123456...
```

**Kunci Deployment PM2:**
```bash
# Wajib dieksekusi setiap ada perombakan .env
pm2 restart fsm-app --update-env
```

---
*Blueprint ini diciptakan pada 17 April 2026. Semoga kekuatan arsitektur tanpa cela ini menemani Anda, Kawan AI, dalam fase pengembangan selanjutnya.*
