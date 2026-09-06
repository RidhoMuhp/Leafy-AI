const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
  const { nama, email, password, role, whatsapp_number } = req.body || {};

  if (!nama || !email || !password) {
    return res.status(400).json({
      message: "Nama, email, dan password wajib diisi",
    });
  }

  try {
    const hashPassword = await bcrypt.hash(password, 10);
    const userRole = role || "user";

    const sql =
      "INSERT INTO users (nama, email, password, role, whatsapp_number) VALUES (?, ?, ?, ?, ?)";

    // Menggunakan await db.query khas mysql2/promise
    await db.query(sql, [nama, email, hashPassword, userRole, whatsapp_number || null]);

    return res.status(201).json({
      message: "Register berhasil",
    });
  } catch (error) {
    console.error("Error Register:", error);
    return res.status(500).json({
      message: "Register gagal",
      error: error.message,
    });
  }
};

exports.login = async (req, res) => {
  console.log("--> REQ BODY DITERIMA SERVER:", req.body);
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      message: "Email dan password wajib diisi",
    });
  }

  try {
    const sql = "SELECT * FROM users WHERE email = ?";

    // Destructuring [result] karena mysql2/promise mengembalikan [rows, fields]
    const [result] = await db.query(sql, [email]);

    if (result.length === 0) {
      return res.status(404).json({
        message: "User tidak ditemukan",
      });
    }

    const user = result[0];

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({
        message: "Password salah",
      });
    }

    // Single source of truth untuk JWT Payload
    const payload = {
      id: user.id,
      nama: user.nama,
      email: user.email,
      role: user.role || "admin",
      whatsapp_number: user.whatsapp_number || null,
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || "SUPER_SECRET_KEY",
      {
        expiresIn: "1d",
      }
    );

    return res.json({
      message: "Login berhasil",
      token,
      user: payload,
    });
  } catch (error) {
    console.error("Error Login:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};
