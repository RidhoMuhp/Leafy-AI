const Groq = require('groq-sdk');
const db = require('../config/db'); // Import koneksi MySQL
require('dotenv').config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Helper untuk mengambil schema/struktur seluruh tabel di MySQL
 */
async function getDatabaseSchema() {
  try {
    const [tables] = await db.query("SHOW TABLES");
    let schemaText = "";

    for (const row of tables) {
      const tableName = Object.values(row)[0];
      const [columns] = await db.query(`DESCRIBE \`${tableName}\``);
      
      const colNames = columns.map(c => `${c.Field} (${c.Type})`).join(", ");
      schemaText += `- Tabel \`${tableName}\`: kolom [${colNames}]\n`;
    }
    return schemaText;
  } catch (error) {
    console.error("Gagal mengambil schema DB:", error);
    return "Tabel yang tersedia: users (id, name, email, created_at)";
  }
}

/**
 * Helper khusus agar Llama menjadi "mulut" untuk memformat semua konteks teks/data
 */
async function formatWithLlama(userPrompt, systemContext) {
  try {
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `Kamu adalah Leafy, AI Assistant WhatsApp yang ramah, profesional, dan responsif.\n` +
                   `Tugasmu adalah menyampaikan informasi/hasil eksekusi ke pengguna secara natural.\n` +
                   `Aturan Formatting:\n` +
                   `- Gunakan format WhatsApp (*bold*, _italic_, bullet point).\n` +
                   `- Berikan jawaban yang tuntas dan ramah.\n` +
                   `- JANGAN menggunakan kalimat template berulang seperti 'Halo! Ada yang bisa dibantu?' di akhir.`
        },
        {
          role: "system",
          content: `KONTEKS PERISTIWA / DATA: ${systemContext}`
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.6
    });

    return response.choices[0]?.message?.content || "Transaksi berhasil diproses.";
  } catch (err) {
    console.error("Error formatting dengan Llama:", err);
    return systemContext;
  }
}

/**
 * Fungsi Utama: AI Agent yang bisa baca & kelola database
 * @param {string} userMessage - Pesan dari pengguna
 * @param {boolean} isManagement - Status apakah user adalah admin terverifikasi
 */
async function askGroqWithDB(userMessage, isManagement = false) {
  try {
    // 1. Dapatkan struktur database real-time
    const schema = await getDatabaseSchema();

    // Aturan keamanan dinamis berdasarkan parameter isManagement
    const securityRules = isManagement 
      ? `MODE: DATAOPS / MANAGEMENT (FULL ACCESS)
         - Pengguna ini adalah Admin Terverifikasi.
         - Kamu diizinkan membuat query SELECT, INSERT, UPDATE, CREATE TABLE, dan DELETE jika diminta.
         - JANGAN PERNAH jalankan DROP TABLE, DROP DATABASE, atau TRUNCATE.`
      : `MODE: PUBLIC / READ-ONLY
         - Pengguna ini adalah User Umum.
         - Hanya boleh buat query SELECT.
         - JANGAN PERNAH buat INSERT, UPDATE, DELETE, DROP, CREATE, atau ALTER.`;

    // 2. System Prompt khusus agar AI membuat Query SQL
    const systemPrompt = `
    Kamu adalah "Leafy", sebuah AI Assistant & Data Analyst untuk WhatsApp.
    Tugasmu adalah membantu pengguna menjawab pertanyaan serta mengelola database.

    STRUKTUR DATABASE SAAT INI:
    ${schema}

    STATUS OTORISASI:
    ${securityRules}

    ATURAN UTAMA:
    1. Jika pertanyaan pengguna membutuhkan akses/perubahan data di database, buatlah QUERY SQL yang valid sesuai otorisasi.
    2. Format responmu HARUS dalam format JSON:
       - Jika butuh query DB: {"type": "sql", "query": "QUERY_SQL_DI_SINI"}
       - Jika pertanyaan umum/sapaan/obrolan: {"type": "chat", "reply": "Respon awal kamu di sini"}
    `;

    // 3. Minta Groq menganalisis maksud user
    const response = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const aiContent = JSON.parse(response.choices[0]?.message?.content || "{}");

    // 4. Jika AI memutuskan perlu mengeksekusi Query SQL (SELECT, INSERT, UPDATE, CREATE, DLL)
    if (aiContent.type === "sql" && aiContent.query) {
      console.log(`🔍 Groq mengeksekusi Query: ${aiContent.query}`);
      
      const cleanQuery = aiContent.query.trim().toUpperCase();

      // Keamanan Tambahan: Validasi Query Berdasarkan Hak Akses
      if (!isManagement) {
        if (!cleanQuery.startsWith("SELECT")) {
          return await formatWithLlama(
            userMessage, 
            "AKSES DITOLAK: Pengguna non-admin mencoba melakukan perubahan data (INSERT/UPDATE/DELETE/CREATE) tanpa izin."
          );
        }
      } else {
        if (cleanQuery.includes("DROP ") || cleanQuery.includes("TRUNCATE ")) {
          return await formatWithLlama(
            userMessage, 
            "PERINTAH DIBLOKIR: Admin mencoba menjalankan DROP atau TRUNCATE yang dilarang demi keselamatan sistem."
          );
        }
      }

      // Jalankan Query ke MySQL
      const [dbResult] = await db.query(aiContent.query);

      // 5. Teruskan HASIL EKSEKUSI DATABASE ke Llama untuk diformat jadi pesan WhatsApp
      const executionContext = `
        Status Eksekusi SQL: Sukses
        Query Dijalankan: ${aiContent.query}
        Hasil dari Database: ${JSON.stringify(dbResult)}
      `;

      return await formatWithLlama(userMessage, executionContext);
    } 
    
    // 6. Jika hanya obrolan biasa (Type = Chat)
    return await formatWithLlama(userMessage, `Pesan Chat Biasa: ${aiContent.reply || userMessage}`);

  } catch (error) {
    console.error("❌ Error AI Agent Database:", error);
    return await formatWithLlama(
      userMessage, 
      `ERROR SISTEM: Terjadi kesalahan internal saat memproses query database. Detail error: ${error.message}`
    );
  }
}

module.exports = { askGroqWithDB, formatWithLlama };