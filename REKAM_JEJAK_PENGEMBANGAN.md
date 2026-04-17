# 🗺️ REKAM JEJAK PENGEMBANGAN AI (HISTORY LOG)
**TANGGAL EKSEKUSI HISTORIS:** 17 April 2026.

Dokumen ini berisi peta masa lalu—kronologi asli bagaimana kerangka kode saat ini bisa terbentuk. Tujuannya adalah agar Sistem AI atau Developer masa depan mengerti kontes debugging (penyelesaian masalah) yang dulu pernah membuang waktu, sehingga kesalahan tersebut tidak diulangi lagi.

## KRONOLOGI PENYELESAIAN MASALAH (BUG-HUNTING)

### 1. Tragedi Library `better-sqlite3` dan Kelahiran Native DB
**Masalah**: Awalnya proyek ini mau menginstal modul npm kesohor `better-sqlite3`. Di Server OS Windows GCP, ia terus-menerus "*Fail to Build*" dan membanting *stack trace* merah karena Virtual Machine tidak punya "Python" & "Visual Studio Build Tools / C++". Fitur laporan *crash* total.
**Solusi Evolusi**: AI pendahulu mengambil keputusan drastis menghapus modul tersebut dan berpindah aliran secara mulus ke library asisten terbaru dari rilis Node.js `node:sqlite`. Tidak ada build C++, instan dan luar biasa tangguh.
*Dampak Samping*: File `database.js` harus direvisi karena `node:sqlite` menolak perintah manipulasi objek seperti `.transaction()`. Itulah kenapa logika Bulk Insert (*Import*, Telegram List) harus ditulis gaya Spartan SQLite asli (`BEGIN` & `COMMIT`). Semuanya terekam rapi (Tidak boleh menaruh fungsi `.transaction()` lagi di masa depan).

### 2. Isu Format Tanggal SQL yang Fatal (`SQL Logic Error`)
**Masalah**: Saat sistem memfilter Dashboard (grafik bulan dan rekapan), web menolak merespon. 
**Penyelesaian**: Modul `node:sqlite` sangat fasis dan ketat dengan standar SQL *string parser*. Menggunakan dua tanda kutip ganda `strftime("%m", date)` membuatnya dianggap sebagai "Nama Kolom Database". AI memperbaiki massal mengubah seluruh *query* menjadi kutipan tunggal (Single-Quote) murni `strftime('%m', date)`. Grafiknya seketika nyala.

### 3. Masalah "Hantu" Caching Windows Environment (`.env`)
**Masalah**: Kunci API (*API Key*) di `<User>/.env` selalu mental dibilang kadaluarsa, meskipun kunci baru dari Google AI Studio sudah di-*paste*! Kenapa? Sistem Windows di server punya tendensi aneh mengunci/menahan memori (`System Variables`). Hal ini membuat panggilan konvensional `process.env.GEMINI_API_KEY` teracuni oleh data kunci yang lama.
**Solusi Brutal**: Modul *dotenvx* di-downgrade jadi `dotenv` murni v16. File `routes/ai.js` dan `telegram-bot.js` diberi "Pintu Bypass Rahasia": Pemanggilan `fs.readFileSync('.env', 'utf8')` disertai ekstraksi Regex manual, untuk merebut Paksa Token tanpa perlu meminta restu `process.env`. Sistem jadi kebal *cache* nyangkut Windows!

### 4. Perang Arsitektur WhatsApp vs Telegram (Menghindari Pemblokiran Meta)
**Diskusi**: User meminta bot WhatsApp. AI mengkaji arsitektur:
- Opsi *Fonnte* Webhook: Dibuang. Sistem ini terlalu statis, kaku/primitif (Butuh perintah "masuk gaji 10rb") dan yang terpenting: MAHAL & BERBAYAR.
- Opsi `Baileys/WA-Web`: Ditolak karena User sangat takut dan fobia diblokir permanen oleh sistem Meta karena ia hanya punya satu HP/Nomer untuk berinteraksi.
**Arah Baru (Pivot Jitu)**: Diinisiasi Pindah Platfom ke **Telegram Bot API**. Nol harga, nol risiko dilarang Meta, dan logika interaksinya bisa dicampur kode memori lokal NodeJS. Munculah file sakti `telegram-bot.js`.

### 5. Kelahiran Fitur "Draf Gantung" (Interactive Telegram Bot)
**Konsep Cemerlang**: Alor *chat* bot tradisional langsung mengeksekusi uang ke database. Fitur ini dirasa cacat kalau AI salah tebak nominal.
**Karya Ahir**: Memori `const pendingTransactions = new Map();` dibentuk. Foto / Cerita User dikirimkan, AI membalas laporan Draf, lalu menyodorkan 2 tombol (*Callback Query Button*) untuk menyuruh User mengeklik persetujuan *(✅/❌)*. Jika disetujuhi barulah di-*insert* ke sqlite. Ini menjadi pencapaian arsitektur yang paling membanggakan!

---
*(End of Transmission - Log Tertutup)*
