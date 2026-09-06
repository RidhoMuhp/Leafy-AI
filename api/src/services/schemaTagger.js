require('dotenv').config();
const Groq = require('groq-sdk');

class SchemaTagger {
  static async autoTagAndCategorize(columns, sampleRows) {
    try {
      const apiKey = process.env.GROQ_API_KEY;

      if (!apiKey) {
        throw new Error("GROQ_API_KEY tidak ditemukan di .env");
      }

      const groq = new Groq({ apiKey });

      const prompt = `
        Kamu adalah Data Engineering Agent.
        Analisis nama kolom dan sampel data dari dokumen/tabel berikut:

        Kolom: ${JSON.stringify(columns)}
        Sampel Data: ${JSON.stringify(sampleRows)}

        Tugasmu:
        1. Tentukan kategori umum dataset ini (pilih salah satu: Academic/Journal, Sales/Financial, Inventory, Customer/CRM, Marketing, Operations, atau Other).
        2. Berikan tag rekomendasi untuk setiap kolom (contoh: "date", "text_unstructured", "numeric", "category").
        3. Berikan saran nama tabel MySQL yang bersih (singkat, lowercase, tanpa spasi, contoh: "journal_documents" atau "sales_data").

        Balas HANYA dalam format JSON valid seperti ini tanpa teks lain/markdown:
        {
          "suggestedTableName": "journal_documents",
          "datasetCategory": "Academic/Journal",
          "columnTags": {
            "baris_ke": "numeric",
            "konten_teks": "text_unstructured"
          }
        }
      `;

      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' }
      });

      const responseText = chatCompletion.choices[0]?.message?.content || '{}';
      return JSON.parse(responseText);

    } catch (error) {
      console.error("⚠️ AI Auto-Tagging Fallback:", error.message);
      
      const isPdfJournal = columns.includes('baris_ke') && columns.includes('konten_teks');

      return {
        suggestedTableName: isPdfJournal ? "journal_documents" : "custom_dataset",
        datasetCategory: isPdfJournal ? "Academic/Journal" : "General Data",
        columnTags: isPdfJournal 
          ? { "baris_ke": "numeric", "konten_teks": "text_unstructured" }
          : {}
      };
    }
  }
}

module.exports = SchemaTagger;