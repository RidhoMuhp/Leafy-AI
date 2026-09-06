const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config();

// Gunakan createPool agar koneksi lebih stabil & mendukung async/await
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Cek koneksi awal
db.getConnection()
  .then((connection) => {
    console.log("🟢 Database Connected Successfully!");
    connection.release();
  })
  .catch((err) => {
    console.error("🔴 Database Connection Failed:", err.message);
  });

module.exports = db;