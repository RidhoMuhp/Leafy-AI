const {
  resolveRole,
} = require("./permissionService");

const {
  ingestDocument,
  PublicAgentError,
} = require("./skillClient");


async function processKnowledgeAttachment({
  senderJid,
  attachment,
  downloadAttachment,
}) {
  const role = resolveRole(senderJid);

  if (
    role !== "admin"
    && role !== "superadmin"
  ) {
    throw new PublicAgentError(
      "Anda tidak memiliki izin "
      + "untuk menyimpan dokumen.",
      "DOCUMENT_ACCESS_DENIED",
    );
  }

  if (
    !attachment
    || typeof downloadAttachment
      !== "function"
  ) {
    throw new PublicAgentError(
      "Lampiran tidak dapat diproses.",
      "INVALID_ATTACHMENT",
    );
  }

  const buffer = await downloadAttachment();

  const response = await ingestDocument({
    role,
    databaseId: "leafy_core",
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    buffer,
  });

  const result = response.result;
  const document = result.document;

  return [
    "*Dokumen berhasil diproses*",
    "",
    `Nama: ${document.original_name}`,
    `Kode: ${document.document_code}`,
    `Jenis: ${document.mime_type}`,
    `Metode ekstraksi: ${
      result.extraction_method
    }`,
    `Jumlah karakter: ${
      result.character_count
    }`,
    `Jumlah bagian: ${
      result.chunk_count
    }`,
    "",
    "Dokumen sekarang dapat dicari "
    + "melalui Leafy AI.",
  ].join("\n");
}


module.exports = {
  processKnowledgeAttachment,
};