function unwrapMessage(message) {
  let content = message;

  for (let index = 0; index < 5; index += 1) {
    if (content?.ephemeralMessage?.message) {
      content = content.ephemeralMessage.message;
      continue;
    }

    if (content?.viewOnceMessage?.message) {
      content = content.viewOnceMessage.message;
      continue;
    }

    if (content?.viewOnceMessageV2?.message) {
      content = content.viewOnceMessageV2.message;
      continue;
    }

    break;
  }

  return content || {};
}

function extractText(message) {
  const content = unwrapMessage(message?.message);

  const text =
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    "";

  return typeof text === "string" ? text.trim() : "";
}

function getMentionedJids(message) {
  const content = unwrapMessage(message?.message);

  const contextInfo =
    content.extendedTextMessage?.contextInfo ||
    content.imageMessage?.contextInfo ||
    content.videoMessage?.contextInfo ||
    content.documentMessage?.contextInfo;

  return Array.isArray(contextInfo?.mentionedJid)
    ? contextInfo.mentionedJid
    : [];
}

module.exports = {
  unwrapMessage,
  extractText,
  getMentionedJids,
};