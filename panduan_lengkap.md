# PANDUAN LENGKAP - FAMILY SMART MONEY 🌐💰

Dokumen ini adalah panduan teknis operasional dan rekam jejak penyelesaian masalah dari aplikasi **Family Smart Money**. Dokumen ini wajib digunakan sebagai rujukan apabila aplikasi ini hendak di-deploy kembali di Virtual Machine (GCP/AWS/Azure) lain di masa depan.

---

## 1. ARSITEKTUR & STACK TEKNOLOGI

Aplikasi ini didesain sebagai **Monolithic Web App** dengan arsitektur **Single Page Application (SPA)** murni agar sangat ringan, super cepat, dan stabil berjalan di server Windows 16GB.

### Frontend
- **HTML/CSS/JS Vanilla**: Tidak menggunakan framework raksasa seperti React/Vue/Tailwind agar tidak memakan memori *(zero-build-process)*.
- **Routing**: `Hash Routing` (contoh: `/#dashboard`, `/#transactions`) lewat JavaScript untuk perpindahan halaman yang sangat mulus tanpa me-*reload* server.
- **Library Tambahan**: 
  - `Chart.js` (Canvas Graphing)
  - `Lucide` (Ikon Vektor SVG)
  - `SheetJS` (Eksport ke Excel `.xlsx`)
  - `jsPDF & AutoTable` (Eksport Laporan ke `.pdf`)
- **Desain UI**: Modern *Glassmorphism*, 100% responsif dengan paradigma Mobile-First (dioptimalkan untuk perangkat layar kecil).

### Backend
- **Node.js (versi >= 22.5.0)**: Wajib versi tinggi karena kita memanfaatkan fitur internal yang baru.
- **Express.js**: Membangun API Endpoint yang me-*return* format JSON murni.
- **Database (`node:sqlite`)**: Menggunakan built-in (bawaan) SQLite dari Node.js terbaru untuk menyimpan data (bukan `better-sqlite3`).

---

## 2. PANDUAN DEPLOYMENT (UNTUK SERVER GCP BARU)

Jika aplikasi ini mau dipindah ke server IP baru, berikut langkah kerjanya:

### A. Persiapan File
1. Pindahkan seluruh source-code folder `family smart money/` ke server baru.
2. (Pastikan Node.js v22+ sudah ter-instal di server baru).

### B. Konfigurasi Background Service (Windows)
Jangan jalankan aplikasi dengan `node server.js` biasa karena akan mati saat RDP (Remote) ditutup. Gunakan sistem **PM2**.
Buka PowerShell Administrator dan jalankan:
```powershell
# 1. Install PM2 dan Module Auto-Startup Windows
npm install -g pm2
npm install -g pm2-windows-startup

# 2. Registrasi Autorun (Startup)
pm2-startup install

# 3. Jalankan Aplikasi
cd "C:\path\ke\folder\family smart money"
npm install
pm2 start server.js --name "fsm-app"

# 4. Simpan kondisi hidup permanen
pm2 save
```

### C. Pembukaan Pintu Firewall (WAJIB DUA LAPIS)
Server Windows di cloud memiliki 2 penjaga pintu ganda (Port 3000):
1. **Firewall Internal Windows Server**
   - Buka PowerShell Administrator: 
   - `New-NetFirewallRule -DisplayName "FSM Port 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow`
2. **Firewall Eksternal GCP VPC**
   - Buka Portal Cloud GCP -> VPC Network -> Firewall
   - Buat baru (`allow-fsm-3000`)
   - Source IP: `0.0.0.0/0`
   - TCP port: `3000`

---

## 3. SEJARAH PENYELESAIAN MASALAH (TROUBLESHOOTING LOG)

Selama proses pembuatan dan perbaikan aplikasi di server Windows saat ini, ada **3 kendala utama** yang telah diselesaikan. Ini dicatat agar tidak membingungkan programmer selanjutnya:

### ❗️ Masalah 1: Gagal Instalasi Database Binary di Windows Server
- **Kasus:** Menginstal library database SQLite ternama (`better-sqlite3`) secara konstan gagal karena membutuhkan sistem *build-tools* Python & Visual Studio C++. Di server virtual cloud, instalasi hal berat seperti C++ sangat merepotkan.
- **Solusi:** Modul `better-sqlite3` **dibuang** dan diganti menggunakan `node:sqlite`. Ini adalah API SQLite built-in bawaan murni yang baru ditambahkan langsung ke dalam mesin bundel Node.js v22.5+. **Zero configuration & Tidak butuh proses build C++!**.

### ❗️ Masalah 2: Error Syntax SQL "strftime()" di Database node:sqlite
- **Kasus:** Saat menampilkan filter / grafik bulan lalu, indikator saldo macet (`SQL logic error`).
- **Penyebab:** Pada database lama, kode `strftime("%m", date)` tidak ada masalah. Tapi `node:sqlite` mengadaptasi keamanan SQL (parser) yang **jauh lebih ketat**. Tanda petik ganda (`"`) dianggap nama kolom, BUKAN teks/string.
- **Solusi:** Di file `transactions.js`, seluruh blok format bulan/tanggal diubah secara absolut menggunakan kutipan tunggal (Single-Quote): diubah murni menjadi `strftime('%m', date)`. Data langsung termuat sempurna secara instan.

### ❗️ Masalah 3: Fitur Backup / Fitur Reset Data tidak Berjalan
- **Kasus:** Pengguna mencoba mereset keseluruhan data di pengaturan tapi fitur me-return Error Server.
- **Penyebab:** Framework sebelumnya menggunakan `db.transaction(() => { ... })` sebagai *wrapper* database. Tetapi API bawaan dari `node:sqlite` (Node.js internal API) memiliki ekosistem _transaction_ yang berbeda.
- **Solusi:** Semua fungsi Bulk-Insert / Eksekusi Massal (Reset dan Restore/Import JSON), ditimpa menjadi kode SQL konvensional yang absolut solid:
  1. `db.exec('BEGIN');` *(Dimulai/Kunci Tabel)*
  2. *(Eksekusi Hapus Semua Data)*
  3. `db.exec('COMMIT');` *(Simpan Perubahan, Berhasil)* atau `db.exec('ROLLBACK')` jika error.

### ❗️ Tambahan: Integrasi Sistem Login Cepat (No-Password)
- **Inisiatif Pengembangan:** Sistem `Auth` dibangun sebagai pelindung layar utama `index.html`.
- **Mekanisme Otomatisasi Session:**
  - Login mengandalkan kecocokan absolut **Nama Lengkap & Email**.
  - Email akan dilacak di DB lokal, jika format ditemukan, sistem akan memvalidasi nama pengguna secara case-insensitive (menghindari nama tertukar dengan kerabat lain). Jika cocok -> *Welcome Back!*
  - Data Login diikat di browser Cache/`localStorage`. Karena ini sistem Web App (PWA), token akan menetap permanen sampai pengguna secara sukarela mengklik opsi "Logout" di tab pengaturan. 

---

## 4. INTEGRASI AI (SMART RECEIPT SCANNER)

Aplikasi memiliki fitur super premium yaitu *AI Smart Receipt* yang dapat mengekstrak daftar belanjaan menggunakan *Google Gemini Vision API*.

### A. Arsitektur AI
- **Model**: `gemini-2.5-flash` (Update: `1.5-flash` sudah di-deprecate oleh Google pada 2026).
- **SDK**: Memanfaatkan pustaka resmi `@google/generative-ai` versi terbaru pada backend (`routes/ai.js`).
- **Prompting**: AI diinstruksikan dengan sangat ketat (Zero-shot) untuk HANYA merespons dalam format Array JSON yang berisikan `storeName` dan himpunan `items[name, price]`.

### B. Manajement API Key (.ENV)
**Ini adalah mekanisme paling krusial yang perlu diperhatikan:**
- File `.env` diletakkan di root server. Jika API Key expired, generate baru melalui jalur [Google AI Studio](https://aistudio.google.com/app/apikey).
- API Key Gemini 100% selalu berawalan huruf `AIza...`. Jangan terkecoh dengan format token Google Cloud yang berawalan `AQ...` atau OAuth token lainnya.
- **PENTING: Masalah Windows System Variables**
  Server Windows (terutama yang dieksekusi via PowerShell PM2) memiliki rekam jejak lingkungan (System Variables) tersendiri. Pada satu kasus, *Environment Variable* tingkat OS Windows menimpa terus nilai dari file `.env` dan menyebabkan "API Key Expired" Error meski `.env` sudah diupdate.
  - **Solusi**: Di `routes/ai.js`, pemanggilan tidak murni mengandalkan `process.env.GEMINI_API_KEY`. Kami mem-bypassnya dengan metode pembacaan manual `fs.readFileSync('.env')` untuk menghindari nilai lawas yang menempel permanen di Windows.
- Setiap ganti API Key, matikan/restart total melalui PM2: `pm2 restart fsm-app --update-env`.

### C. Alur Kerja (Workaround) UI Frontend Dinamis
Demi **menjaga struktur murni Database SQLite agar tidak berubah (tetap 1 baris input transaksi)**, ekstrak daftar belanja dari AI tidak dibuatkan/di-insert ke tabel baru di database, melainkan dirombak di sisi JavaScript Antarmuka Layar (UI) *Device* pengguna:
1. Keranjang Belanja Dinamis akan dilahirkan ke udara secara real-time via `document.createElement()`.
2. Pengguna bebas mengedit harga/nominal/hapus barang satu persatu *(Review phase)*. JavaScript `window.syncAiToForm()` akan melakukan agregat perhitungan dinamis di latar belakang tanpa me-*refresh* DOM page utama.
3. Begitu diklik "Simpan", JavaScript akan memilin/merajut data Array Object belanja tersebut menjadi *String* vertikal dengan poin-poin/list teks *(bullet-points)* yang dicocokkan ke dalam kolom Keterangan/Deskripsi standar. Sistem *Single Table* tetap awet 100% tanpa relasi *(ForeignKey)* berlapis.

---
**Status Aplikasi Terkini**: _STABLE_, _PRODUCTION-READY_, BERJALAN MELALUI _PM2_ SECARA PERMANEN (BACKGROUND-LOCKED), DENGAN FITUR ARTIFICIAL INTELLIGENCE MENYALA.
