const axios = require('axios');
const FormData = require('form-data');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
// Menggunakan '../db' jika db.js berada satu tingkat di luar folder services
const db = require('../config/db');
const {formatWithLlama} = require('./aiService'); // Import fungsi formatWithLlama dari aiService.js

async function handleDocumentImage(sock, msg) {

    const from = msg.key?.remoteJid;
    if (!from) return;

    try {  
        const imageMessage = msg.message.imageMessage;
        if (!imageMessage) return;

        await sock.sendPresenceUpdate('composing', from); 


        // 2. Download Buffer Gambar dari WhatsApp
        const stream = await downloadContentFromMessage(imageMessage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        // 3. Bungkus Buffer Gambar ke FormData
        const formData = new FormData();
        formData.append('file', buffer, {
            filename: 'document.jpg',
            contentType: imageMessage.mimetype || 'image/jpeg',
        });

        // 4. Kirim ke Endpoint FastAPI OCR
        const response = await axios.post('http://127.0.0.1:8000/process-document', formData, {
            headers: {
                ...formData.getHeaders()
            }
        });

        const result = response.data;

        if (result.status === 'success') {
            const { category, summary, extracted_fields } = result.data;

            // 5. Simpan Hasilnya ke Database MySQL (leafy_ai)
            const query = `
                INSERT INTO document_records (sender_jid, file_name, category, summary, extracted_data)
                VALUES (?, ?, ?, ?, ?)
            `;
            await db.execute(query, [
                from,
                'WA_Image.jpg',
                category,
                summary,
                JSON.stringify(extracted_fields)
            ]);

            const ocrContext = `
              DOKUMEN BERHASIL DIPROSES DAN DISIMPAN KE DATABASE!
              - Kategori Dokumen: ${category}
              - Ringkasan Dokumen: ${summary}
              - Detail Data Ekstraksi (JSON): ${JSON.stringify(extracted_fields)}
            `;
            
            const replyText = await formatWithLlama(
            "User baru saja kirim foto dokumen/nota.", 
            ocrContext
            );

            await sock.sendPresenceUpdate('paused', from);
            await sock.sendMessage(from, { text: replyText }, { quoted: msg });
        } else {
            const errorReply = await formatWithLlama(
              "User mengunggah foto tetapi OCR gagal membaca isinya.",
              "Status: Gagal menguji/membaca teks dari dokumen gambar."
            );
            
            await sock.sendPresenceUpdate('paused', from);
            await sock.sendMessage(from, { text: errorReply }, { quoted: msg });
        }

    } catch (error) {
        console.error("Error processing document:", error.message);
        
        const systemErrorReply = await formatWithLlama(
          "User mengunggah dokumen tetapi terjadi error teknis di server.",
          `Detail Error: ${error.message}`
        );
        
        // Pastikan status dipause juga pada blok catch jika terjadi error
        await sock.sendPresenceUpdate('paused', from);
        await sock.sendMessage(from, { text: systemErrorReply }, { quoted: msg });
    }
}

module.exports = { handleDocumentImage };