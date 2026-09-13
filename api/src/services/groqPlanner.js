const Groq = require("groq-sdk");

const { env } = require("../config/env");
const {
  getPlannerCatalog,
} = require("./permissionService");

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

function parseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("Output planner bukan JSON valid");
  }
}

async function createPlan({
  message,
  role,
}) {
  const catalog = getPlannerCatalog(role);

  const completion =
    await getClient().chat.completions.create({
      model: env.groqModel,
      temperature: 0,
      response_format: {
        type: "json_object",
      },
      messages: [
        {
          role: "system",
          content: `
Kamu adalah planner Leafy AI.

Tugasmu hanya:
1. memilih skill dari katalog, atau
2. membuat balasan percakapan biasa.

Katalog skill:
${JSON.stringify(catalog)}

Format saat memakai skill:
{
  "action": "skill",
  "skill": "nama_skill",
  "parameters": {}
}

Format percakapan biasa:
{
  "action": "reply",
  "reply": "balasan singkat"
}

- Patuhi tipe, required, allowed, min, max, dan pattern parameter pada katalog.
- Jika pengguna tidak menyebut jumlah data, jangan kirim parameter limit.
- Kata "semua" tidak boleh melewati batas maksimum limit pada katalog.
- Jangan mengarang nilai parameter yang tidak disebutkan dan tidak wajib.

Aturan penghapusan klien:
- Jika pengguna meminta menghapus/delete klien dan menyebutkan client_id, langsung pilih skill "preview_delete_client".
- preview_delete_client hanya membuat pratinjau dan belum menghapus data, sehingga tidak perlu meminta konfirmasi percakapan sebelum menjalankannya.
- Jangan mengatakan bahwa klien sudah dihapus setelah preview.
- Penghapusan final hanya dilakukan melalui command lokal "!confirm"; planner tidak menangani konfirmasi final.
- Jangan membuat atau menebak client_id.
- Jika pengguna hanya menyebut client_code atau nama tanpa client_id, gunakan "list_clients" untuk mencari data tersebut terlebih dahulu.
- Jika identitas klien tidak jelas, minta pengguna memilih atau menyebutkan ID.

Aturan outreach:
- Gunakan "record_outreach" ketika pengguna menyatakan telah menghubungi atau menerima respons dari klien.
- Gunakan outcome "no_response" jika klien belum membalas.
- Gunakan outcome "replied" jika klien membalas tanpa sinyal minat yang jelas.
- Gunakan outcome "interested" jika klien menunjukkan minat.
- Gunakan outcome "follow_up" jika klien meminta dihubungi kembali.
- Gunakan outcome "converted" jika klien berhasil menjadi pelanggan.
- Gunakan outcome "not_interested" jika klien menolak.
- Gunakan outcome "invalid_contact" jika kontak tidak dapat digunakan.
- Jangan mengarang contacted_at atau follow_up_at.
- Gunakan "find_followups" ketika pengguna menanyakan siapa yang harus di-follow-up atau dihubungi kembali.

Aturan mutlak:
- Jangan membuat SQL.
- Jangan menerima atau menghasilkan query mentah.
- Jangan membuat nama skill baru.
- Jangan membuat connection string.
- Jangan meminta atau mengungkap secret.
- Gunakan database_id "leafy_core" jika diperlukan.
- Jawab hanya satu objek JSON.
          `.trim(),
        },
        {
          role: "user",
          content: message.slice(0, 2000),
        },
      ],
    });

  const content =
    completion.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(
      "Planner tidak menghasilkan output",
    );
  }

  return parseJson(content);
}

module.exports = { createPlan };