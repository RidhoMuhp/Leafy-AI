const { askGroqWithDB, formatWithLlama } = require('./aiService');
const { handleDocumentImage } = require('./ocrHandler'); // 1. Import OCR Handler
const ParserService = require('./ParserService'); // Import ParserService untuk PDF, Word, Excel, TXT
const { downloadContentFromMessage, makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

// Koneksi MySQL
const db = require('../config/db'); 

// Session Storage (Key: Sender JID individu, Value: Session State)
const userSessions = new Map();

let sock = null;

/**
 * Helper untuk Verifikasi Apakah Pengirim Adalah Admin Terdaftar di DB
 * @param {string} senderJid - WhatsApp JID Pengirim
 */
async function isAdminUser(senderJid) {
  try {
    const [rows] = await db.query(
      "SELECT id, name, role FROM admins WHERE phone_number = ? LIMIT 1",
      [senderJid]
    );
    
    if (rows.length > 0) {
      return { isAdmin: true, adminData: rows[0] };
    }
    return { isAdmin: false, adminData: null };
  } catch (error) {
    console.error("❌ Error saat verifikasi admin di DB:", error);
    return { isAdmin: false, adminData: null };
  }
}

/**
 * Inisialisasi Koneksi WhatsApp Bot
 */
async function connectToWhatsApp() {
  const authPath = path.join(__dirname, '../../auth_info_baileys');
  const { state, saveCreds } = await useMultiFileAuthState(authPath);

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n==================================================");
      console.log("📲 SCAN QR CODE INI DENGAN WHATSAPP KAMU:");
      console.log("==================================================\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const shouldReconnect = !isLoggedOut;
      
      console.log(`❌ Koneksi WhatsApp terputus (Status Code: ${statusCode}). Reconnecting: ${shouldReconnect}`);
      
      if (isLoggedOut) {
        console.log("🧹 Sesi telah di-logout. Menghapus data auth lama...");
        if (fs.existsSync(authPath)) {
          fs.rmSync(authPath, { recursive: true, force: true });
        }
      }

      if (shouldReconnect) {
        connectToWhatsApp();
      } else {
        console.log("💡 Sesi berakhir. Silakan restart server untuk scan QR Code baru.");
      }
    } else if (connection === 'open') {
      console.log("\n🟢 WHATSAPP BOT BERHASIL TERHUBUNG & SIAP DIGUNAKAN! 🚀\n");
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const remoteJid = msg.key.remoteJid;
      const isGroup = remoteJid.endsWith('@g.us');

      // Ambil teks atau caption dari berbagai jenis tipe pesan
      const messageText = 
        msg.message.conversation || 
        msg.message.extendedTextMessage?.text || 
        msg.message.imageMessage?.caption ||
        msg.message.documentMessage?.caption ||
        "";
      const cleanMessageText = messageText.replace(/@\d+/g, '').trim();

      // 🛑 1. FILTER KETAT CHAT GRUP (Ditempatkan paling atas sebelum pemprosesan pesan/media)
      if (isGroup) {
        const contextInfo = 
          msg.message.extendedTextMessage?.contextInfo ||
          msg.message.imageMessage?.contextInfo ||
          msg.message.documentMessage?.contextInfo;

        const mentionedJid = contextInfo?.mentionedJid || [];
        
        const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const isBotMentioned = mentionedJid.includes(botNumber);
        const isCommand = cleanMessageText.startsWith('!');
        
        // Memakai RegEx \bai\b agar hanya memicu kata "AI" utuh (bukan kata "baik", "main", dll)
        const isCalledByName = 
          cleanMessageText.toLowerCase().includes('leafy') || 
          /\bai\b/i.test(cleanMessageText);

        // Jika pesan terjadi di grup dan TIDAK memenuhi salah satu pemicu di atas, abaikan
        if (!isBotMentioned && !isCommand && !isCalledByName) {
          continue; 
        }
      }

      // -------------------------------------------------------------
      // 📸 2. CEK DAN INTEGRASIKAN OCR GAMBAR (Hanya diproses jika lolos filter grup)
      // -------------------------------------------------------------
      if (msg.message.imageMessage) {
        console.log(`📷 Pesan gambar diterima dari [${isGroup ? 'GRUP' : 'PRIVATE'}] - (${remoteJid}). Menjalankan OCR Engine...`);
        await handleDocumentImage(sock, msg);
        continue; 
      }

      // -------------------------------------------------------------
      // 📄 3. CEK DAN PENANGANAN DOKUMEN FILE (Hanya diproses jika lolos filter grup)
      // -------------------------------------------------------------
      if (msg.message.documentMessage) {
        console.log(`📄 Dokumen diterima dari [${isGroup ? 'GRUP' : 'PRIVATE'}] - (${remoteJid}). Memproses Base Knowledge...`);
        await handleDocumentUpload(sock, msg);
        continue;
      }

      // -------------------------------------------------------------
      // 💬 4. PEMPROSESAN PESAN TEKS
      // -------------------------------------------------------------
      console.log(`📩 Pesan masuk dari [${isGroup ? 'GRUP' : 'PRIVATE'}] - (${remoteJid}): "${cleanMessageText}"`);

      // Kirim pesan ke handler teks
      await handleIncomingMessage(remoteJid, cleanMessageText, msg);
    }
  });
}

/**
 * Handler Khusus Ekstraksi File Dokumen & Simpan ke Knowledge Base (MySQL)
 */
async function handleDocumentUpload(sock, msg) {
  const from = msg.key?.remoteJid;
  if (!from) return;

  try {
    const docMsg = msg.message?.documentMessage;
    if (!docMsg) return;

    // 1. Tampilkan status "mengetik..."
    await sock.sendPresenceUpdate('composing', from);

    // 2. Download Buffer Dokumen dari WA
    const stream = await downloadContentFromMessage(docMsg, 'document');
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }

    const fileName = docMsg.fileName || 'dokumen_tanpa_nama';
    const mimeType = docMsg.mimetype || '';

    // 3. Ekstrak Teks Menggunakan ParserService
    const extractedText = await ParserService.parseToPlainText(buffer, mimeType, fileName);

    // 4. Simpan ke Database MySQL (knowledge_base)
    const query = `
      INSERT INTO knowledge_base (sender_jid, file_name, doc_type, full_text)
      VALUES (?, ?, ?, ?)
    `;
    await db.execute(query, [from, fileName, mimeType, extractedText]);

    // 5. Susun Konteks Kejadian untuk Disampaikan ke Llama
    const context = `
      DOKUMEN DITAMBAHKAN KE KNOWLEDGE BASE:
      - Nama File: ${fileName}
      - Tipe File: ${mimeType}

        Berikut adalah isi teks yang berhasil diekstrak dari dokumen tersebut:
      """
      ${extractedText.substring(0, 4000)} 
      """

      TUGAS KAMU:
      1. Berikan RINGKASAN SINGKAT dari isi dokumen tersebut.
      2. Tampilkan POIN-POIN PENTING (bullet points) utama dari isi dokumen.
      3. Buat jawaban yang rapi, komunikatif, dan mudah dibaca di WhatsApp.
      4. JANGAN sebutkan atau beritahu bahwa file telah disimpan di database atau sistem.
    `;

    const replyText = await askGroqWithDB(context, false);

    await sock.sendPresenceUpdate('paused', from);
    await sock.sendMessage(from, { text: replyText }, { quoted: msg });

  } catch (error) {
    console.error("❌ Error membaca dokumen:", error.message);
    if (sock) await sock.sendPresenceUpdate('paused', from);
    await sock.sendMessage(
      from, 
      { text: `⚠️ *Gagal Membaca Dokumen*\n\nTerjadi kesalahan saat mengekstraksi file: _${error.message}_` }, 
      { quoted: msg }
    );
  }
}

/**
 * Handler Pemprosesan Pesan Teks + Integrasi Database & Groq AI
 */
async function handleIncomingMessage(remoteJid, text, rawMsg) {
  const rawText = text.trim();
  const cleanText = rawText.toLowerCase();

  if (!rawText) return;

  try {
    // Tampilkan indikator "mengetik..."
    if (sock) await sock.sendPresenceUpdate('composing', remoteJid);

    // 🔒 Ambil ID asli pengirim (bukan ID grup)
    const senderJid = rawMsg.key.participant || remoteJid;

    // -------------------------------------------------------------
    // 🔒 1. CEK TAG KHUSUS DATAOPS / MANAGEMENT & VERIFIKASI ADMIN DB
    // -------------------------------------------------------------
    const isDataOpsCall = 
      cleanText.includes('leafy_management') || 
      cleanText.includes('leafy_dataops') ||
      cleanText.includes('leafydataops');

    // Ambil mode dari session berdasarkan ID pengirim
    let isManagementMode = userSessions.get(senderJid)?.isManagementMode || false;

    if (isDataOpsCall) {
      console.log(`🔒 Verifikasi akses DataOps untuk sender: ${senderJid}...`);
      
      const { isAdmin, adminData } = await isAdminUser(senderJid);

      if (!isAdmin) {
        const accessDeniedMsg = 
          `⛔ *AKSES DITOLAK (UNAUTHORIZED)*\n\n` +
          `Nomor kamu (\`${senderJid.split('@')[0]}\`) tidak terdaftar sebagai Admin/DataOps di sistem.\n` +
          `Perintah manajemen database (CRUD) dibatasi hanya untuk personel berwenang.`;
        
        if (sock) await sock.sendPresenceUpdate('paused', remoteJid);
        await sendMessage(remoteJid, accessDeniedMsg, rawMsg);
        return;
      }

      // Simpan status session untuk senderJid ini
      isManagementMode = true;
      userSessions.set(senderJid, { isManagementMode: true });
      console.log(`✅ Akses Diberikan & Sesi Disimpan! Admin terverifikasi: ${adminData.name} (${adminData.role})`);
    }

    // Command untuk Mereset/Keluar dari Mode DataOps kembali ke Public/Read-Only
    if (cleanText === '!exitdataops' || cleanText === '!publicmode') {
      userSessions.delete(senderJid);
      if (sock) await sock.sendPresenceUpdate('paused', remoteJid);
      await sendMessage(remoteJid, "🔄 Mode DataOps dinonaktifkan. Kamu sekarang kembali ke *PUBLIC / READ-ONLY Mode*.", rawMsg);
      return;
    }

    // -------------------------------------------------------------
    // 2. Command Tes Bawaan
    // -------------------------------------------------------------
    if (cleanText === '!ping') {
      if (sock) await sock.sendPresenceUpdate('paused', remoteJid);
      await sendMessage(remoteJid, "Pong! 🏓 Bot WhatsApp aktif dan terhubung ke REST API Backend.", rawMsg);
      return;
    }

    // 3. Command Cek Tabel Database
    if (cleanText === '!tables') {
      const [tables] = await db.query("SHOW TABLES");
      
      let responseMsg = "📊 *DAFTAR TABEL DATABASE*\n\n";
      if (tables.length === 0) {
        responseMsg += "Database masih kosong (belum ada tabel).";
      } else {
        tables.forEach((row, index) => {
          const tableName = Object.values(row)[0];
          responseMsg += `${index + 1}. \`${tableName}\`\n`;
        });
      }
      
      if (sock) await sock.sendPresenceUpdate('paused', remoteJid);
      await sendMessage(remoteJid, responseMsg, rawMsg);
      return;
    }

    // 4. Command Cek Data User
    if (cleanText === '!users' || cleanText === '!cekuser') {
      const [rows] = await db.query("SELECT id, name, email FROM users LIMIT 5");

      let responseMsg = `👥 *DATA USER (Top 5)*\nTotal ditemukan: ${rows.length}\n\n`;
      
      if (rows.length === 0) {
        responseMsg += "Belum ada data user di database.";
      } else {
        rows.forEach((u, i) => {
          responseMsg += `${i + 1}. *${u.name || 'Tanpa Nama'}* (${u.email || '-'})\n`;
        });
      }

      if (sock) await sock.sendPresenceUpdate('paused', remoteJid);
      await sendMessage(remoteJid, responseMsg, rawMsg);
      return;
    }

    // 5. Command Menu Bantuan
    if (cleanText === '!help' || cleanText === 'help') {
      const helpMsg = 
        `🤖 *DATABASE & AI AGENT BOT*\n\n` +
        `Daftar Perintah Tersedia:\n` +
        `• *!ping* : Cek status bot\n` +
        `• *!tables* : Lihat daftar tabel MySQL\n` +
        `• *!users* : Lihat data user dari database\n` +
        `• *!exitdataops* : Keluar dari mode DataOps (kembali ke Read-Only)\n` +
        `• *!logout* : Mengeluarkan akun WhatsApp dari bot\n` +
        `• *!help* : Menampilkan bantuan ini\n\n` +
        `📸 *Ekstraksi Nota/Gambar:* Kirim foto nota/struk belanja untuk dibaca via OCR!\n` +
        `📄 *Base Knowledge:* Kirim file dokumen (PDF, Word, Excel, TXT, JSON) untuk disimpan sebagai acuan AI!\n\n` +
        `🔑 *Perintah DataOps (Khusus Admin):*\n` +
        `Ketik tag \`leafy_dataops\` sekali untuk masuk ke mode full access (INSERT/UPDATE/DELETE).\n\n` +
        `💡 *Tips Grup:* Tag/Mention bot atau gunakan awalan *!* untuk bertanya ke AI di grup!`;
      
      if (sock) await sock.sendPresenceUpdate('paused', remoteJid);
      await sendMessage(remoteJid, helpMsg, rawMsg);
      return;
    }

    // 6. Command Logout
    if (cleanText === '!logout') {
      if (sock) await sock.sendPresenceUpdate('paused', remoteJid);
      await sendMessage(remoteJid, "👋 Mengeluarkan akun WhatsApp dari Bot...", rawMsg);
      if (sock) {
        await sock.logout();
        console.log("⚠️ Bot berhasil di-logout!");
      }
      return;
    }

    // -------------------------------------------------------------
    // 7. Integrasi AI Agent (Groq): Kirim status isManagementMode ke aiService
    // -------------------------------------------------------------
    console.log(` Mengirim ke Groq AI DB Agent (Management Mode: ${isManagementMode}): "${rawText}"`);
    
    const aiReply = await askGroqWithDB(rawText, isManagementMode);
    
    if (sock) await sock.sendPresenceUpdate('paused', remoteJid);
    await sendMessage(remoteJid, aiReply, rawMsg);

  } catch (error) {
    console.error(" Error saat memproses pesan/query database:", error);
    if (sock) await sock.sendPresenceUpdate('paused', remoteJid);
    await sendMessage(remoteJid, "Terjadi kesalahan internal saat mengakses server.", rawMsg);
  }
}

/**
 * Helper untuk Mengirim Pesan Teks (Mendukung Reply di Grup)
 */
async function sendMessage(to, text, quotedMessage = null) {
  if (!sock) {
    console.error("WhatsApp Socket belum siap!");
    return;
  }
  try {
    const options = { text: text };
    
    if (quotedMessage) {
      options.quoted = quotedMessage;
    }

    await sock.sendMessage(to, options);
  } catch (error) {
    console.error("Gagal mengirim pesan WA:", error);
  }
}

module.exports = {
  connectToWhatsApp,
  sendMessage
};