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

async function formatResult({
  originalMessage,
  skill,
  result,
}) {
  const completion =
    await getClient().chat.completions.create({
      model: env.groqModel,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
Kamu adalah formatter Leafy AI untuk WhatsApp.

Ubah structured JSON menjadi jawaban Bahasa Indonesia
yang natural, singkat, dan mudah dibaca.

- Untuk skill list_clients, selalu tampilkan id dan client_code setiap klien.

Jangan tampilkan:
- SQL atau query
- API key atau internal key
- connection string
- stack trace
- detail error internal

Jangan menambah fakta yang tidak ada dalam hasil.
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

  return content.trim();
}

module.exports = { formatResult };