<div align="center">
  <h1>💰 Family Smart Money</h1>
  <p><strong>Aplikasi Keuangan Multi-User Cerdas dengan Scan Struk AI ✨</strong></p>
  <img src="https://img.shields.io/badge/Node.js-v22-success" alt="Node.js">
  <img src="https://img.shields.io/badge/Database-SQLite_Native-blue" alt="SQLite">
  <img src="https://img.shields.io/badge/AI-Google_Gemini-orange?logo=google" alt="Google Gemini">
  <img src="https://img.shields.io/badge/UI-Mobile_First-purple" alt="Mobile First UI">
</div>

---

Family Smart Money adalah sistem pelaporan keuangan rumah tangga/UMKM berarsitektur monolitik berbasis Node.js yang sangat ringan, tanpa *framework* gemuk, dan murni fokus pada performa instan *(Single Page Application)*.

Terobosan utamanya adalah fitur **Smart Receipt Scanner** bertenaga Artificial Intelligence dari Google Gemini. Anda cukup memfoto struk belanja fisik, dan AI akan merombaknya ke bentuk keranjang input elektronik yang terstruktur dalam satu kedipan mata.

![App Dashboard Preview](https://via.placeholder.com/800x400.png?text=Family+Smart+Money+Dashboard) 

*(Ganti link gambar di atas dengan screenshot asli aplikasi web Web App Anda)*

## 🌟 Fitur Utama (Core Features)

- **🤖 AI Smart Receipt (Tarik Data Otomatis):** Cukup unggah struk belanja dari kasir, dan antarmuka keranjang dinamis *(Reconstructive Dynamic UI)* akan muncul otomatis berisi ringkasan nama barang, nominal persatuan, dan kalkulasi total uang secara instan.
- **⚡ Architektur Tanpa Lag (Zero-Lag SPA):** Tidak ada rekaan *loading page*. Semua rute berpindah di latar belakang klien secara langsung.
- **📄 Cetak Laporan Profesional:** Eksport seluruh pembukuan ke PDF atau seret datanya ke Excel (`.xlsx`) hanya dengan satu tombol klik.
- **🔐 Multi-Pencatat Aman (Role System):** Mendukung pencatatan bergilir (Bapak, Ibu, Anak) tanpa login rumit namun tetap dibatasi ruang kerjanya.
- **💾 Basis Data Embedded Ultra Ringan:** Sepenuhnya dikawal oleh native library `node:sqlite` dari rilis Node.js terbaru tanpa resiko instalasi dependensi C++ berat yang merusak VM Windows/Linux Anda.

## 🛠️ Tech Stack & Alat Pembangun
- **Frontend**: Vanilla JavaScript (ES12+), CSS Variables murni, Lucide Icons.
- **Backend API**: Node.js, Express.js.
- **Database Engine**: `node:sqlite` berkecepatan tinggi `WAL Mode` aktif.
- **Artificial Intelligence**: SDK Resmi `@google/generative-ai` (Model V2.5-Flash).

## 🚀 Panduan Menjalankan (.Env & Server)

Aplikasi ini sangat mudah disebarkan ke Server Publik (VPS Linux/Windows). 

**1. Persiapan:**  
Pastikan Komputer/Server Anda sudah ter-update minimal menggunakan Node.js **Versi 22.5.0** ke atas (karena SQLite native berada di rilisan ini).

**2. Instalasi:**
```bash
git clone https://github.com/Mrizalfahlepi/family-smart-money.git
cd family-smart-money
npm install
```

**3. Konfigurasi AI Rahasia:**
Buat sebuah file utuh bernama `.env` (tanpa kata *example* di belakangnya) pada root folder. Dapatkan API Key Anda di Google AI Studio secara gratis.
```bash
GEMINI_API_KEY=AIzA_MASUKAN_API_KEY_ANDA_DI_SINI
```

**4. Start (Coba Jalankan Luring):**
```bash
node server.js
```
Kunjungi `http://localhost:3000` di mesin Anda!

**5. Start Untuk Server / Produksi 24 Jam (Pakai PM2):**
```bash
npm install -g pm2
pm2 start server.js --name "fsm-app"
```

## 📜 Lisensi & Pengakuan (Open Source)
Dikembangkan penuh kasih dan keringat oleh **Muhammad Rizal Fahlevi**, ditujukan secara Open Source untuk semua developer Indonesia yang bermimpi menata masa depan pembukuan keuangan cerdas keluarga & UMKM!

Punya gagasan gila? Ketemu masalah? Silakan lempar Issue Baru atau sampaikan Pull Request Anda!
