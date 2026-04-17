const TelegramBot = require('node-telegram-bot-api');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('./database');
const fs = require('fs');
const path = require('path');

function readApiKey() {
  try {
    const envPath = path.join(__dirname, '.env');
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^GEMINI_API_KEY=(.+)$/m);
    if (match) return match[1].trim();
  } catch(e) {}
  return process.env.GEMINI_API_KEY;
}

const genAI = new GoogleGenerativeAI(readApiKey());

module.exports = function startBot() {
  let token = process.env.TELEGRAM_BOT_TOKEN;
  try {
    const envPath = path.join(__dirname, '.env');
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m);
    if (match) token = match[1].trim();
  } catch(e) {}

  if (!token) {
    console.log('[TELEGRAM] Tidak ada API token, bot dinonaktifkan.');
    return;
  }

  const bot = new TelegramBot(token, { polling: true });
  
  // STATE CACHE: Menyimpan Draf Transaksi Sementara sebelum di-ACC User
  const pendingTransactions = new Map(); // chatId -> [transactions...]

  bot.onText(new RegExp('^/start'), (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '🤖 *Family Smart Money Bot*\n\nSilakan kirimkan:\n1. Teks Biasa ("Gaji 10jt, beli kopi 15rb")\n2. 📸 Foto Struk Belanja\n\nNanti AI akan memilahnya dan saya akan meminta **Konfirmasi Anda dengan menekan tombol** sebelum menyimpannya ke database Web App!', { parse_mode: 'Markdown' });
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const photo = msg.photo;

    // Abaikan command awal & jika tidak ada teks/foto
    if (text && text.startsWith('/')) return;
    if (!text && !photo) return;

    let loadingMsg;

    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: "application/json" }
      });

      let result;
      let aiOutput;

      if (photo && photo.length > 0) {
        // --- SCENARIO 1: IMAGE RECEIPT (Membaca Foto) ---
        loadingMsg = await bot.sendMessage(chatId, '⏳ _Mata AI sedang mencoba membaca foto struk Anda..._', { parse_mode: 'Markdown' });
        
        // Ambil resolusi gambar terbesar
        const fileId = photo[photo.length - 1].file_id;
        const file = await bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
        
        // Unduh gambar mentah dari API Telegram ke Memory
        const response = await fetch(fileUrl);
        const arrayBuffer = await response.arrayBuffer();
        const base64Img = Buffer.from(arrayBuffer).toString('base64');
        
        const promptStruk = `Anda adalah kasir AI pembaca resi/struk belanja keuangan keluarga. Ekstrak data struk gambar tersebut dalam format JSON wajib berikut:
{
  "storeName": "Nama Toko (Opsional)",
  "transactions": [
    { "type": "expense", "amount": 15000, "description": "Nama Barang 1" },
    { "type": "expense", "amount": 20000, "description": "Nama Barang 2" }
  ]
}
Aturan: Semua item barang yang dibeli otomatis berstatus type="expense". amount wajib ANGKA MURNI (integer dilarang ada titik/koma/Rp). description wajib memuat nama barang persis di struk tapi rapi. Abaikan item non-barang seperti PPN/Kembalian kecuali user menginstruksikan.`;
        
        // Eksekusi Gemini Multi-modal (Vision)
        result = await model.generateContent([
          promptStruk,
          { inlineData: { data: base64Img, mimeType: "image/jpeg" } }
        ]);

      } else if (text) {
        // --- SCENARIO 2: TEXT MESSAGE (Cerita Acak) ---
        loadingMsg = await bot.sendMessage(chatId, '⏳ _Otak AI sedang memilah cerita catatan Anda..._', { parse_mode: 'Markdown' });
        
        const promptTeks = `Anda adalah seorang asisten pencatat akuntansi keuangan rumah tangga. Ekstrak cerita random user ini menjadi format JSON ketat:
{
  "transactions": [
    { "type": "income", "amount": 10000000, "description": "Gaji papa" },
    { "type": "expense", "amount": 15000, "description": "Kopi" }
  ]
}
Aturan Ketat: "type" HANYA boleh "income" atau "expense". "amount" angka murni integer tanpa titik koma. "description" usahakan singkat 1-4 kata. Bila pesan user cuma tanya/sapaan tanpa uang, kembalikan array transactions kosong [].
Teks User: "${text}"`;
        result = await model.generateContent(promptTeks);
      }

      // --- PENGOLAHAN OUTPUT GLOBAL ---
      aiOutput = JSON.parse(result.response.text());
      const txs = aiOutput.transactions || (aiOutput.items /* kompensasi kadang gemini mereturn item */) || [];

      if (!txs || txs.length === 0) {
        bot.editMessageText('❌ Gagal mengenali daftar uang dari gambar/teks tersebut. Coba gunakan foto yang lebih jelas atau kalimat yang lain.', { chat_id: chatId, message_id: loadingMsg.message_id });
        return;
      }

      // TAHAN: Simpan Draf Transaksi Ke Memori (STATE MAP)
      pendingTransactions.set(chatId, txs);
      
      // Susun Tampilan Review untuk User Telegram
      let previewStr = '📝 *Draf Laporan Tertangkap:*\n\n';
      if (aiOutput.storeName && aiOutput.storeName !== "Toko tidak diketahui") {
        previewStr += `🏪 Merchant: *${aiOutput.storeName}*\n\n`;
      }
      
      let totalExpense = 0;
      let totalIncome = 0;

      txs.forEach((tx, idx) => {
        const icon = tx.type === 'income' ? '💚' : '🔴';
        previewStr += `${idx+1}. ${icon} Rp ${parseInt(tx.amount).toLocaleString('id-ID')} (${tx.description})\n`;
        if (tx.type === 'expense') totalExpense += parseInt(tx.amount);
        if (tx.type === 'income') totalIncome += parseInt(tx.amount);
      });
      
      if (totalExpense > 0) previewStr += `\n📦 Total Belanja: *Rp ${totalExpense.toLocaleString('id-ID')}*`;
      if (totalIncome > 0) previewStr += `\n💰 Total Masuk: *Rp ${totalIncome.toLocaleString('id-ID')}*`;

      previewStr += `\n\n*Apakah rincian dan harganya sudah tepat?*`;

      // Eksekusi Pemasangan Tombol Ajaib (Inline Keyboard)
      const options = {
        chat_id: chatId, 
        message_id: loadingMsg.message_id, 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Sesuai, Simpan Ke Web App!", callback_data: "CONFIRM_YES" }
            ],
            [
              { text: "❌ Ada yang salah (Batal)", callback_data: "CONFIRM_NO" }
            ]
          ]
        }
      };

      bot.editMessageText(previewStr, options);

    } catch (error) {
      console.error('[TELEGRAM BOT ERROR]', error.message);
      if (loadingMsg) bot.editMessageText('⚠️ Terjadi error saat proses konversi AI.', { chat_id: chatId, message_id: loadingMsg.message_id });
    }
  });

  // --- PENANGANAN EVENT TOMBOL (CALLBACK QUERY) ---
  bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const msgId = query.message.message_id;
    const action = query.data;

    // Cek apakah draf memorinya masih ada (belum basi)
    const dataPending = pendingTransactions.get(chatId);

    if (!dataPending) {
      bot.answerCallbackQuery(query.id, { text: '❌ Sesi draf ini sudah kadaluarsa/hilang. Silakan kirim ulang.', show_alert: true });
      return;
    }

    if (action === 'CONFIRM_NO') {
      // User membatalkan struk karena typo/AI salah baca
      pendingTransactions.delete(chatId); // hapus memori
      const batalMsg = '❌ *Dibatalkan!*\nDraf telah dihapus dari antrean.\n\n_Silakan ketik ulang ralatnya secara manual (Teks biasa) untuk item yang salah tadi._';
      bot.editMessageText(batalMsg, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' });
      bot.answerCallbackQuery(query.id);
      return;
    }

    if (action === 'CONFIRM_YES') {
      // User Menyetujui! Suntikkan Ke Database Sekarang
      try {
        const today = new Date().toISOString().slice(0, 10);
        const insertStmt = db.prepare(`
          INSERT INTO transactions (type, amount, category_id, description, recorded_by, date)
          VALUES (?, ?, NULL, ?, 'Telegram Bot', ?)
        `);

        db.exec('BEGIN');
        try {
          dataPending.forEach(tx => {
            insertStmt.run(tx.type, tx.amount, tx.description, today);
          });
          db.exec('COMMIT');
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }

        // Sukses
        bot.editMessageText('✅ *Sempurna!*\nTransaksi telah selesai direkam dan dikunci aman ke dalam Database Laporan Anda.', { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' });
        pendingTransactions.delete(chatId); // bersihkan draf
        bot.answerCallbackQuery(query.id, { text: 'Tersimpan Permanen!' });
        
      } catch (e) {
        console.error('[DB INSERT ERROR]', e);
        bot.answerCallbackQuery(query.id, { text: 'Error internal gagal menyimpan.', show_alert: true });
      }
    }
  });

  console.log('🤖 [TELEGRAM] Master Bot Interaktif ON!');
};
