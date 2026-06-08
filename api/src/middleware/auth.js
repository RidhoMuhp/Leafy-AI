const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({
      message: "Token tidak ada",
    });
  }

  try {
    const verified = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);

    req.user = verified;

    next();
  } catch (error) {
    res.status(401).json({
      message: "Token tidak valid",
    });
  }
};

module.exports = verifyToken;