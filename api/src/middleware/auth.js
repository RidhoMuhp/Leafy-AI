const jwt = require("jsonwebtoken");

// 1. Verifikasi Token JWT
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({
      message: "Token tidak ada",
    });
  }

  try {
    const verified = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);
    req.user = verified; // Menyimpan payload user (id, role, dll)
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Token tidak valid",
    });
  }
};

// 2. Verifikasi Role (Admin / Staff / User)
const verifyRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "User tidak terautentikasi" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Akses ditolak! Hak akses '${req.user.role}' tidak diizinkan.`,
      });
    }

    next();
  };
};

// Export keduanya dalam bentuk object
module.exports = {
  verifyToken,
  verifyRole,
};