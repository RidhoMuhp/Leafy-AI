const app = require("./index");
const { connectToWhatsApp } = require('./services/whatsappService');
require("./config/db");

const PORT = process.env.PORT || 3000;

// Tambahkan kata 'async' di depan () =>
app.listen(PORT, async () => {
  console.log(`Server berjalan di port ${PORT}`);

  console.log("⚡ Menginisialisasi WhatsApp Bot Service...");
  try {
    await connectToWhatsApp();
  } catch (error) {
    console.error("Gagal koneksi WhatsApp Bot:", error);
  }
});