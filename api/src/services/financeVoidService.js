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


const CONFIRM_VOID_PATTERN =
  /^!confirm-void\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s+([A-Za-z0-9_-]{32,100})$/i;


function isFinanceVoidConfirmation(text) {
  return (
    typeof text === "string" &&
    text
      .trim()
      .toLowerCase()
      .startsWith("!confirm-void")
  );
}


function formatFinanceVoidPreview(result) {
  const transaction = result.transaction;

  return [
    "*Preview pembatalan transaksi*",
    "",
    `ID: ${transaction.id}`,
    `Kode: ${transaction.transaction_code}`,
    `Jenis: ${transaction.transaction_type}`,
    `Deskripsi: ${transaction.description}`,
    `Jumlah: ${transaction.amount} ${transaction.currency}`,
    `Status saat ini: ${transaction.status}`,
    `Alasan: ${result.reason}`,
    "",
    "Untuk mengonfirmasi, kirim:",
    `!confirm-void ${result.action_id} ` +
      result.confirmation_token,
    "",
    "Konfirmasi berlaku selama 10 menit.",
  ].join("\n");
}


async function processFinanceVoidConfirmation({
  senderJid,
  text,
}) {
  const role = resolveRole(senderJid);

  if (role !== "superadmin") {
    throw new PublicAgentError(
      "Anda tidak memiliki izin untuk membatalkan transaksi.",
      "FINANCE_VOID_ACCESS_DENIED",
    );
  }

  const match = text.trim().match(
    CONFIRM_VOID_PATTERN,
  );

  if (!match) {
    throw new PublicAgentError(
      "Format konfirmasi pembatalan tidak valid.",
      "INVALID_FINANCE_VOID_CONFIRMATION",
    );
  }

  const [, actionId, confirmationToken] =
    match;

  const actorId = createActorId(senderJid);

  const response = await executeSkill({
    skill: "confirm_void_finance_transaction",
    role,
    actorId,
    parameters: {
      database_id: "leafy_core",
      action_id: actionId.toLowerCase(),
      confirmation_token:
        confirmationToken,
    },
  });

  const transaction =
    response.result.transaction;

  return [
    "*Transaksi berhasil dibatalkan*",
    "",
    `ID: ${transaction.id}`,
    `Kode: ${transaction.transaction_code}`,
    `Jenis: ${transaction.transaction_type}`,
    `Deskripsi: ${transaction.description}`,
    `Jumlah: ${transaction.amount} ${transaction.currency}`,
    `Status: ${transaction.status}`,
    `Alasan: ${transaction.void_reason}`,
    "",
    "Transaksi tetap tersimpan sebagai jejak audit dan tidak dihitung dalam ringkasan arus kas.",
  ].join("\n");
}


module.exports = {
  formatFinanceVoidPreview,
  isFinanceVoidConfirmation,
  processFinanceVoidConfirmation,
};
