require("dotenv").config();

const app = require("./index");
require("./config/db");

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Leafy AI API berjalan di port ${PORT}`);

  if (process.env.WHATSAPP_ENABLED !== "true") {
    console.log("WhatsApp service dinonaktifkan.");
    return;
  }

  try {
    const { connectToWhatsApp } = require("./services/whatsappService");
    await connectToWhatsApp();
  } catch (error) {
    console.error("Gagal menjalankan WhatsApp:", error.message);
  }
});