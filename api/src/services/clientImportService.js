const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

const { env } = require("../config/env");
const {
  PublicAgentError,
} = require("./skillClient");

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  ".csv",
  ".xlsx",
]);

function validateDocument(document, buffer) {
  if (
    !document ||
    typeof document.fileName !== "string"
  ) {
    throw new PublicAgentError(
      "Nama dokumen tidak valid.",
      "INVALID_DOCUMENT",
    );
  }

  const safeFileName = path.basename(
    document.fileName,
  );

  const extension = path
    .extname(safeFileName)
    .toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new PublicAgentError(
      "Saat ini Leafy hanya menerima file XLSX dan CSV.",
      "UNSUPPORTED_DOCUMENT",
    );
  }

  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length === 0
  ) {
    throw new PublicAgentError(
      "Dokumen tidak memiliki isi.",
      "EMPTY_DOCUMENT",
    );
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new PublicAgentError(
      "Ukuran dokumen melebihi batas 5 MB.",
      "DOCUMENT_TOO_LARGE",
    );
  }

  return {
    safeFileName,
    extension,
  };
}

async function previewClientImport({
  document,
  buffer,
  role,
  actorId,
}) {
  if (!env.internalKey) {
    throw new Error(
      "Internal key belum dikonfigurasi",
    );
  }

  const {
    safeFileName,
  } = validateDocument(
    document,
    buffer,
  );

  const form = new FormData();

  form.append("role", role);
  form.append("actor_id", actorId);
  form.append("database_id", "leafy_core");

  form.append(
    "file",
    buffer,
    {
      filename: safeFileName,
      contentType:
        document.mimeType ||
        "application/octet-stream",
      knownLength: buffer.length,
    },
  );

  try {
    const response = await axios.post(
      `${env.skillServiceUrl}` +
        "/imports/clients/preview",
      form,
      {
        headers: {
          ...form.getHeaders(),
          "x-leafy-internal-key":
            env.internalKey,
        },
        timeout: 30000,
        maxBodyLength: MAX_FILE_SIZE + 1024 * 100,
        maxContentLength:
          MAX_FILE_SIZE + 1024 * 100,
      },
    );

    return response.data.result;
  } catch (error) {
    if (error.isPublic === true) {
      throw error;
    }

    const status = error.response?.status;
    const detail =
      error.response?.data?.detail;

    console.error(
      "Client import preview failed:",
      {
        status: status || "unavailable",
        fileName: safeFileName,
      },
    );

    if (status === 401) {
      throw new Error(
        "Internal service authentication failed",
      );
    }

    if (status === 403) {
      throw new PublicAgentError(
        "Anda tidak memiliki izin untuk mengimpor klien.",
        "IMPORT_ACCESS_DENIED",
      );
    }

    if (
      status === 400 ||
      status === 422
    ) {
      throw new PublicAgentError(
        typeof detail === "string"
          ? detail
          : "Isi dokumen tidak valid.",
        "INVALID_IMPORT_DOCUMENT",
      );
    }

    if (status === 503) {
      throw new PublicAgentError(
        "Database sedang tidak dapat diakses.",
        "DATABASE_UNAVAILABLE",
      );
    }

    throw new Error(
      "Layanan impor klien tidak dapat diakses",
    );
  }
}

function formatImportPreview(result) {
  const summary = result.summary;

  const lines = [
    "*Preview impor klien*",
    "",
    `File: ${result.file.name}`,
    `Total data: ${summary.total_rows}`,
    `Data baru: ${summary.new_rows}`,
    `Sudah tersedia: ${summary.existing_rows}`,
    `Duplikat dalam file: ${
      summary.duplicate_file_rows
    }`,
    `Data tidak valid: ${
      summary.invalid_rows
    }`,
  ];

  if (
    Array.isArray(
      result.existing_client_codes,
    ) &&
    result.existing_client_codes.length > 0
  ) {
    lines.push(
      "",
      "Kode yang sudah tersedia:",
      result.existing_client_codes
        .slice(0, 10)
        .map((code) => `- ${code}`)
        .join("\n"),
    );
  }

  if (
    Array.isArray(
      result.invalid_row_details,
    ) &&
    result.invalid_row_details.length > 0
  ) {
    lines.push(
      "",
      "Baris tidak valid:",
      result.invalid_row_details
        .slice(0, 5)
        .map((item) => {
          const errors = item.errors
            .map(
              (error) =>
                `${error.field}: ${error.message}`,
            )
            .join(", ");

          return `- Baris ${item.row}: ${errors}`;
        })
        .join("\n"),
    );
  }

  if (
    !result.action_id ||
    !result.confirmation_token
  ) {
    lines.push(
      "",
      "Tidak ada data baru yang dapat diimpor.",
    );

    return lines.join("\n");
  }

  lines.push(
    "",
    "Untuk mengimpor data baru, kirim:",
    `!confirm-import ${result.action_id} ` +
      result.confirmation_token,
    "",
    "Konfirmasi berlaku selama 10 menit.",
  );

  return lines.join("\n");
}

module.exports = {
  previewClientImport,
  formatImportPreview,
};