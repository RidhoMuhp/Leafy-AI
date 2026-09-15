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

    if (
      content?.documentWithCaptionMessage?.message
    ) {
      content =
        content.documentWithCaptionMessage.message;
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

  return typeof text === "string"
    ? text.trim()
    : "";
}

function extractDocumentMetadata(message) {
  const content = unwrapMessage(message?.message);
  const document = content.documentMessage;

  if (!document) {
    return null;
  }

  const rawLength =
    document.fileLength?.toString?.() ||
    document.fileLength ||
    "0";

  const fileLength = Number(rawLength);

  return {
    fileName:
      typeof document.fileName === "string"
        ? document.fileName.trim()
        : "",
    mimeType:
      typeof document.mimetype === "string"
        ? document.mimetype.trim()
        : "application/octet-stream",
    fileLength:
      Number.isFinite(fileLength)
        ? fileLength
        : 0,
    caption:
      typeof document.caption === "string"
        ? document.caption.trim()
        : "",
  };
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
  extractDocumentMetadata,
  getMentionedJids,
};