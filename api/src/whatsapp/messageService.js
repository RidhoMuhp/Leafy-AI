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

function normalizeFileLength(value) {
  const rawValue =
    value?.toString?.() ||
    value ||
    "0";

  const fileLength = Number(rawValue);

  return Number.isFinite(fileLength)
    ? fileLength
    : 0;
}


function getImageExtension(mimeType) {
  if (mimeType === "image/png") {
    return ".png";
  }

  return ".jpg";
}


function extractAttachmentMetadata(message) {
  const content = unwrapMessage(
    message?.message,
  );

  const document = content.documentMessage;

  if (document) {
    return {
      sourceType: "document",
      fileName:
        typeof document.fileName === "string"
          ? document.fileName.trim()
          : "",
      mimeType:
        typeof document.mimetype === "string"
          ? document.mimetype.trim()
          : "application/octet-stream",
      fileLength: normalizeFileLength(
        document.fileLength,
      ),
      caption:
        typeof document.caption === "string"
          ? document.caption.trim()
          : "",
    };
  }

  const image = content.imageMessage;

  if (image) {
    const mimeType =
      typeof image.mimetype === "string"
        ? image.mimetype.trim()
        : "image/jpeg";

    const messageId =
      typeof message?.key?.id === "string"
        ? message.key.id
        : Date.now().toString();

    return {
      sourceType: "image",
      fileName:
        `whatsapp-image-${messageId}`
        + getImageExtension(mimeType),
      mimeType,
      fileLength: normalizeFileLength(
        image.fileLength,
      ),
      caption:
        typeof image.caption === "string"
          ? image.caption.trim()
          : "",
    };
  }

  return null;
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
  extractAttachmentMetadata,
  getMentionedJids,
};