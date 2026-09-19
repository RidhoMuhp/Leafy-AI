const crypto = require("crypto");

const { env } = require("../config/env");
const {
  normalizeJid,
} = require("../whatsapp/jidService");

function createActorId(senderJid) {
  const normalizedJid = normalizeJid(senderJid);

  if (!normalizedJid) {
    throw new Error("Actor identity tidak valid");
  }

  if (!env.internalKey) {
    throw new Error(
      "Internal key belum dikonfigurasi",
    );
  }

  return crypto
    .createHmac("sha256", env.internalKey)
    .update(normalizedJid)
    .digest("hex");
}

module.exports = {
  createActorId,
};
