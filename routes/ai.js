const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Baca API Key langsung dari file .env (bypass Windows System Environment Variable)
function readApiKey() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^GEMINI_API_KEY=(.+)$/m);
    if (match) return match[1].trim();
  } catch(e) {}
  return process.env.GEMINI_API_KEY;
}

// Inisialisasi Gemini SDK
const genAI = new GoogleGenerativeAI(readApiKey());

router.post('/scan-receipt', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ success: false, message: 'Gambar tidak ditemukan.' });
    }

    // Ekstrak base64 murni jika ada prefix "data:image/jpeg;base64,"
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `Anda adalah asisten data entry. Berdasarkan gambar struk belanja, esktrak data ke dalam format JSON dengan struktur yang kaku berikut:
1. "storeName": String, Nama toko atau tempat.
2. "items": Array dari objek. Setiap objek memiliki "name" (Nama barang, string) dan "price" (Harga satuan/total barang tersebut, integer tanpa titik).

Format Wajib HANYA JSON:
{
  "storeName": "Indomaret",
  "items": [
    { "name": "Biskuit Coklat", "price": 10000 },
    { "name": "Susu Tawar", "price": 5000 },
    { "name": "Kantong Plastik", "price": 500 }
  ]
}`;

    const part = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType || 'image/jpeg'
      }
    };

    const result = await model.generateContent([prompt, part]);
    const responseText = result.response.text();
    const jsonOutput = JSON.parse(responseText);

    res.json({
      success: true,
      data: {
        storeName: jsonOutput.storeName,
        items: jsonOutput.items || []
      }
    });

  } catch (error) {
    console.error('[AI SCAN ERROR]', error);
    res.status(500).json({ success: false, message: 'Gagal memproses struk. Pastikan gambar jelas atau gunakan gambar lain.' });
  }
});

module.exports = router;
