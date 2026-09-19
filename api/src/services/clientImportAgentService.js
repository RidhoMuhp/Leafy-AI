const {
  createActorId,
} = require("./actorService");

const {
  resolveRole,
} = require("./permissionService");

const {
  executeSkill,
  PublicAgentError,
} = require("./skillClient");

const {
  previewClientImport,
  formatImportPreview,
} = require("./clientImportService");


const CONFIRM_IMPORT_PATTERN =
  /^!confirm-import\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s+([A-Za-z0-9_-]{32,100})$/i;


async function processClientDocument({
  senderJid,
  document,
  downloadDocument,
}) {
  const role = resolveRole(senderJid);

  if (role !== "superadmin") {
    throw new PublicAgentError(
      "Anda tidak memiliki izin untuk mengimpor klien.",
      "IMPORT_ACCESS_DENIED",
    );
  }

  if (
    !document ||
    typeof downloadDocument !== "function"
  ) {
    throw new PublicAgentError(
      "Dokumen tidak dapat diproses.",
      "INVALID_DOCUMENT",
    );
  }

  const actorId = createActorId(senderJid);
  const buffer = await downloadDocument();

  const preview = await previewClientImport({
    document,
    buffer,
    role,
    actorId,
  });

  return formatImportPreview(preview);
}


function isImportConfirmation(text) {
  return (
    typeof text === "string" &&
    text
      .trim()
      .toLowerCase()
      .startsWith("!confirm-import")
  );
}


async function processImportConfirmation({
  senderJid,
  text,
}) {
  const role = resolveRole(senderJid);

  if (role !== "superadmin") {
    throw new PublicAgentError(
      "Anda tidak memiliki izin untuk mengimpor klien.",
      "IMPORT_ACCESS_DENIED",
    );
  }

  const match = text.trim().match(
    CONFIRM_IMPORT_PATTERN,
  );

  if (!match) {
    throw new PublicAgentError(
      "Format konfirmasi impor tidak valid.",
      "INVALID_IMPORT_CONFIRMATION",
    );
  }

  const [, actionId, confirmationToken] =
    match;

  const actorId = createActorId(senderJid);

  const response = await executeSkill({
    skill: "confirm_client_import",
    role,
    actorId,
    parameters: {
      database_id: "leafy_core",
      action_id: actionId.toLowerCase(),
      confirmation_token:
        confirmationToken,
    },
  });

  const result = response.result;

  const lines = [
    "*Impor klien berhasil*",
    "",
    `File: ${result.file_name}`,
    `Data ditambahkan: ${result.imported_count}`,
    `Data dilewati karena sudah tersedia: ${
      result.skipped_existing_count
    }`,
  ];

  if (
    Array.isArray(
      result.imported_client_codes,
    ) &&
    result.imported_client_codes.length > 0
  ) {
    lines.push(
      "",
      "Klien baru:",
      result.imported_client_codes
        .slice(0, 20)
        .map((code) => `- ${code}`)
        .join("\n"),
    );
  }

  lines.push(
    "",
    "Klien baru siap masuk proses reach-out.",
    );

  return lines.join("\n");
}


module.exports = {
  isImportConfirmation,
  processClientDocument,
  processImportConfirmation,
};