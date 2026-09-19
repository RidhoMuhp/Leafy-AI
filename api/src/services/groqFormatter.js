const Groq = require("groq-sdk");

const { env } = require("../config/env");

let groqClient = null;

function getClient() {
  if (!env.groqApiKey) {
    throw new Error("Groq belum dikonfigurasi");
  }

  if (!groqClient) {
    groqClient = new Groq({
      apiKey: env.groqApiKey,
    });
  }

  return groqClient;
}

function normalizeWhatsAppText(content) {
  return content
    .replace(/\\([*_~`])/g, "$1")
    .replace(/\*{2,}/g, "*")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function appendDocumentSources(
  formattedText,
  result,
) {
  const items = Array.isArray(
    result?.results,
  )
    ? result.results
    : [];

  if (items.length === 0) {
    return formattedText;
  }

  const seen = new Set();
  const sources = [];

  for (const item of items) {
    const sourceKey = [
      item.document_code,
      item.chunk_index,
    ].join(":");

    if (seen.has(sourceKey)) {
      continue;
    }

    seen.add(sourceKey);

    sources.push(
      `- ${item.original_name} `
      + `(${item.document_code}, `
      + `bagian ${item.chunk_index})`,
    );
  }

  if (sources.length === 0) {
    return formattedText;
  }

  return [
    formattedText,
    "",
    "*Sumber dokumen:*",
    ...sources.slice(0, 5),
  ].join("\n");
}

async function formatResult({
  originalMessage,
  skill,
  result,
}) {
  const completion =
    await getClient().chat.completions.create({
      model: env.groqModel,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
Kamu adalah formatter Leafy AI untuk WhatsApp.

Ubah structured JSON menjadi jawaban Bahasa Indonesia
yang natural, singkat, dan mudah dibaca.

- Jika sumber menggunakan image_ocr atau pdf_text_ocr dan
  memuat nominal, beri catatan agar pengguna memverifikasi
  nominal pada dokumen asli sebelum tindakan keuangan.
- Jika tersedia nilai hasil normalisasi dan OCR asli, gunakan
  nilai normalisasi tetapi jangan menghapus catatan OCR asli.
- Untuk get_daily_business_summary, tampilkan secara ringkas:
  tanggal laporan, kondisi klien, aktivitas outreach,
  follow-up yang perlu dilakukan, ringkasan keuangan,
  dan prioritas tindakan.
- Jangan menyebut saldo rekening. Gunakan istilah
  "arus kas bersih".
- Jangan mengatakan semua aman jika masih ada action_items.
- Jangan mengarang nomor telepon, jadwal, nominal,
  atau aktivitas yang tidak tersedia pada result.


Aturan format WhatsApp:
- Gunakan satu tanda bintang untuk teks tebal: *teks*.
- Jangan pernah menggunakan dua tanda bintang.
- Jangan memakai heading Markdown dengan tanda #.
- Jangan memakai tabel Markdown.
- Jangan menambahkan backslash sebelum *, _, atau karakter lain.
- Ubah nilai snake_case menjadi kata yang natural.
- Jangan mengubah ID, client_code, action_id, atau token.
- Untuk list_finance_transactions, selalu tampilkan id dan
  transaction_code setiap transaksi.

Aturan data:
- Untuk skill list_clients, selalu tampilkan id dan client_code setiap klien.
- Jika result memiliki field timezone, gunakan timezone tersebut.
- Jika result tidak memiliki timezone, jangan menebak WIB, WITA, atau WIT.
- Jangan mengubah jam tanpa informasi konversi yang jelas.
- Jangan menambah fakta yang tidak ada dalam hasil.

Jangan tampilkan:
- SQL atau query
- API key atau internal key
- connection string
- stack trace
- detail error internal
          `.trim(),
        },
        {
          role: "user",
          content: JSON.stringify({
            request: originalMessage,
            skill,
            result,
          }),
        },
      ],
    });

  const content =
    completion.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(
      "Formatter tidak menghasilkan jawaban",
    );
  }

  const formattedText =
    normalizeWhatsAppText(content);

  if (skill === "search_knowledge") {
    return appendDocumentSources(
      formattedText,
      result,
    );
  }

return formattedText;
}



module.exports = {
  formatResult,
};