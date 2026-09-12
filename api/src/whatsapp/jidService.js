const {
  isJidGroup,
  jidNormalizedUser,
} = require("@whiskeysockets/baileys");

function normalizeJid(jid) {
  if (typeof jid !== "string" || jid.trim() === "") {
    return null;
  }

  const cleanJid = jid.trim();

  if (isJidGroup(cleanJid)) {
    return cleanJid;
  }

  try {
    return jidNormalizedUser(cleanJid);
  } catch {
    return cleanJid;
  }
}

function getMessageIdentity(message) {
  const key = message?.key || {};
  const chatJid = normalizeJid(key.remoteJid);

  if (!chatJid) {
    return null;
  }

  const isGroup = isJidGroup(chatJid);
  const senderJid = normalizeJid(
    isGroup ? key.participant : key.remoteJid,
  );

  if (!senderJid) {
    return null;
  }

  return {
    messageId: key.id || null,
    chatJid,
    senderJid,
    participantJid: normalizeJid(key.participant),
    isGroup,
    fromMe: key.fromMe === true,
  };
}

function getSocketIdentity(socket) {
  const user = socket?.user;

  if (!user) {
    return {
      primaryJid: null,
      lid: null,
    };
  }

  return {
    primaryJid: normalizeJid(user.id),
    lid: normalizeJid(user.lid),
  };
}

module.exports = {
  normalizeJid,
  getMessageIdentity,
  getSocketIdentity,
};