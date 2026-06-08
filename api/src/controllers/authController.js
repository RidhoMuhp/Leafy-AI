const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
  const { nama, email, password } = req.body;

  const hashPassword = await bcrypt.hash(password, 10);

  const sql = "INSERT INTO users (nama, email, password) VALUES (?, ?, ?)";

  db.query(sql, [nama, email, hashPassword], (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }

    res.json({
      message: "Register berhasil",
    });
  });
};

exports.login = (req, res) => {
  const { email, password } = req.body;

  const sql = "SELECT * FROM users WHERE email = ?";

  db.query(sql, [email], async (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }

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

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    res.json({
      message: "Login berhasil",
      token,
    });
  });
};