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
  
  // STATE CACHE: Menyimpan Draf Transaksi Sementara
  // Format map: chatId -> { userId, txs: [] }
  const pendingTransactions = new Map();

  bot.onText(new RegExp('^/start'), (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `🤖 *System Startup*\n\nSelamat datang di Bot Otomatisasi Kasir!\n\n🔑 **Chat ID Anda**: \`${chatId}\`\n\nJika Anda pelanggan baru, pastikan Anda masuk ke *Web Dashboard*, lalu ke menu *Pengaturan/Profil*, dan masukkan **Chat ID** Anda di sana untuk menautkan bot ini ke Toko Anda.`, { parse_mode: 'Markdown' });
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const photo = msg.photo;

    // Abaikan command awal & pesan kosong
    if (text && text.startsWith('/')) return;
    if (!text && !photo) return;

    // ─── PROTEKSI MULTI-TENANT (Wajib Terdaftar!) ───
    const user = db.get("SELECT id, name FROM users WHERE telegram_chat_id = ?", String(chatId));
    
    if (!user) {
      bot.sendMessage(chatId, `🚫 **Akses Tersumbat!**\n\nNomor KTP Bot Anda (\`${chatId}\`) belum terdaftar atau ditautkan pada Dashboard Akuntansi mana pun.\n\nSilahkan minta admin/owner toko untuk menautkan angka tersebut ke profilnya.`, { parse_mode: 'Markdown' });
      return;
    }

    let loadingMsg;

    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: "application/json" }
      });

      let result;
      let aiOutput;

      if (photo && photo.length > 0) {
        // --- IMAGE RECEIPT ---
        loadingMsg = await bot.sendMessage(chatId, `Halo Pak/Bu ${user.name}, Mata AI sedang memindai struk Anda...`, { parse_mode: 'Markdown' });
        
        const fileId = photo[photo.length - 1].file_id;
        const file = await bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
        
        const response = await fetch(fileUrl);
        const arrayBuffer = await response.arrayBuffer();
        const base64Img = Buffer.from(arrayBuffer).toString('base64');
        
        const promptStruk = `Anda adalah kasir AI analitis. Ekstrak data struk format JSON wajib berikut:
{
  "storeName": "Nama Toko",
  "transactions": [
    { "type": "expense", "amount": 52500, "description": "Sania 1LT (3x)" }
  ]
}
ATURAN KRUSIAL:
1. "amount": WAJIB HANYA mengambil HARGA TOTAL/SUBTOTAL BARIS TERSEBUT. JANGAN harga satuan.
2. "description": WAJIB gabungkan jumlah Kuantitas barang ke dalam nama.
3. type="expense". Abaikan PPN/Kembali/Subtotal Bawah.`;
        
        result = await model.generateContent([
          promptStruk,
          { inlineData: { data: base64Img, mimeType: "image/jpeg" } }
        ]);

      } else if (text) {
        // --- TEXT MESSAGE ---
        loadingMsg = await bot.sendMessage(chatId, `Halo Pak/Bu ${user.name}, merangkum teks Anda...`, { parse_mode: 'Markdown' });
        
        const promptTeks = `Ekstrak cerita user ini menjadi JSON:
{
  "transactions": [
    { "type": "income", "amount": 10000000, "description": "Gaji papa" },
    { "type": "expense", "amount": 15000, "description": "Kopi" }
  ]
}
Aturan: "type" HANYA boleh "income" / "expense". "amount" murni angka integer. Teks User: "${text}"`;
        result = await model.generateContent(promptTeks);
      }

      aiOutput = JSON.parse(result.response.text());
      const txs = aiOutput.transactions || aiOutput.items || [];

      if (!txs || txs.length === 0) {
        bot.editMessageText('Gagal mengenali daftar uang dari gambar/teks tersebut. Coba gunakan foto yang lebih jelas.', { chat_id: chatId, message_id: loadingMsg.message_id });
        return;
      }

      // SIMPAN NEGARA STATE!
      pendingTransactions.set(chatId, { userId: user.id, txs: txs });
      
      let previewStr = `*Draf Laporan Tertangkap untuk Toko ${user.name}:*\n\n`;
      let totalExpense = 0; let totalIncome = 0;

      txs.forEach((tx, idx) => {
        const icon = tx.type === 'income' ? '💰' : '💸';
        previewStr += `${idx+1}. ${icon} Rp ${parseInt(tx.amount).toLocaleString('id-ID')} (${tx.description})\n`;
        if (tx.type === 'expense') totalExpense += parseInt(tx.amount);
        if (tx.type === 'income') totalIncome += parseInt(tx.amount);
      });
      
      if (totalExpense > 0) previewStr += `\n🔴 Total Pengeluaran: *Rp ${totalExpense.toLocaleString('id-ID')}*`;
      if (totalIncome > 0) previewStr += `\n🟢 Total Pemasukan: *Rp ${totalIncome.toLocaleString('id-ID')}*`;
      previewStr += `\n\n*Apakah sudah betul?*`;

      bot.editMessageText(previewStr, {
        chat_id: chatId, 
        message_id: loadingMsg.message_id, 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Betul, Simpan Ke Web", callback_data: "CONFIRM_YES" }],
            [{ text: "❌ Batalkan", callback_data: "CONFIRM_NO" }]
          ]
        }
      });

    } catch (error) {
      console.error('[TELEGRAM BOT ERROR]', error.message);
      if (loadingMsg) bot.editMessageText('⚠️ Terjadi error internal bot.', { chat_id: chatId, message_id: loadingMsg.message_id });
    }
  });

  bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const msgId = query.message.message_id;
    const action = query.data;

    const dataPending = pendingTransactions.get(chatId);

    if (!dataPending) {
      bot.answerCallbackQuery(query.id, { text: 'Sesi habis.', show_alert: true });
      return;
    }

    if (action === 'CONFIRM_NO') {
      pendingTransactions.delete(chatId);
      bot.editMessageText('❌ *Dibatalkan!*', { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' });
      bot.answerCallbackQuery(query.id);
      return;
    }

    if (action === 'CONFIRM_YES') {
      try {
        const today = new Date().toISOString().slice(0, 10);
        // INSERT dengan user_id
        const insertStmt = db.prepare(`
          INSERT INTO transactions (user_id, type, amount, category_id, description, recorded_by, date)
          VALUES (?, ?, ?, NULL, ?, 'Telegram Bot', ?)
        `);

        db.exec('BEGIN');
        try {
          dataPending.txs.forEach(tx => {
            insertStmt.run(dataPending.userId, tx.type, tx.amount, tx.description, today);
          });
          db.exec('COMMIT');
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }

        bot.editMessageText('✅ *Sukses!*\nTransaksi telah selesai dikunci ke dalam Database Laporan Anda.', { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' });
        pendingTransactions.delete(chatId);
        bot.answerCallbackQuery(query.id, { text: 'Tersimpan Permanen!' });
        
      } catch (e) {
        console.error('[DB INSERT ERROR]', e);
        bot.answerCallbackQuery(query.id, { text: 'Error gagal insert DB.', show_alert: true });
      }
    }
  });

  console.log('🤖 [TELEGRAM] Master Bot Interaktif (SaaS Mode) ON!');
};
