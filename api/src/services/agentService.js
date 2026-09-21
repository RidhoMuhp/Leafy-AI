const { createPlan } = require("./groqPlanner");
const { executeSkill } = require("./skillClient");
const { formatResult } = require("./groqFormatter");
const {
  resolveRole,
  validatePlan,
} = require("./permissionService");
const { createActorId } = require("./actorService");
const {
  formatFinanceVoidPreview,
} = require("./financeVoidService");


function formatDeletePreview(result) {
  const client = result.client;

  return [
    "*Konfirmasi penghapusan klien*",
    "",
    `ID: ${client.id}`,
    `Kode: ${client.client_code}`,
    `Nama: ${client.name}`,
    `Status: ${client.status}`,
    `Riwayat outreach: ${result.outreach_count}`,
    "",
    "*Peringatan:* data akan dihapus permanen.",
    "",
    "Untuk mengonfirmasi, kirim:",
    `!confirm ${result.action_id} ${result.confirmation_token}`,
    "",
    "Konfirmasi berlaku selama 10 menit.",
  ].join("\n");
}


function formatDeleteResult(result) {
  const client = result.client;

  return [
    "*Klien berhasil dihapus*",
    "",
    `ID: ${client.id}`,
    `Kode: ${client.client_code}`,
    `Nama: ${client.name}`,
  ].join("\n");
}


function formatDocumentDeleteResult(result) {
  const document = result.document;
  const displayCode =
    document.short_code ||
    document.document_code;

  return [
    "*Dokumen berhasil dihapus*",
    "",
    `Kode: ${displayCode}`,
    `Nama: ${document.original_name}`,
    `Bagian dihapus: ${result.deleted_chunk_count}`,
  ].join("\n");
}


function resolveDocumentDeleteReference(
  text,
  documentContext,
) {
  const normalized = text.trim();

  if (!/\b(?:hapus|delete)\b/i.test(normalized)) {
    return null;
  }

  const shortCode = normalized.match(
    /\b[A-Z]{3}-\d{6}-\d{2}\b/i,
  )?.[0];
  if (shortCode) return shortCode.toUpperCase();

  const internalCode = normalized.match(
    /\bDOC-[A-Z0-9]+\b/i,
  )?.[0];
  if (internalCode) return internalCode.toUpperCase();

  if (
    /\b(?:dokumen|file)\s+(?:ini|terakhir|yang sama)\b/i
      .test(normalized)
  ) {
    return (
      documentContext?.shortCode ||
      documentContext?.documentCode ||
      ""
    );
  }

  const fileName = normalized
    .replace(/^.*?\b(?:hapus|delete)\b\s*/i, "")
    .replace(/^(?:dokumen|file)\s+/i, "")
    .replace(/^(?:dengan\s+)?kode\s+/i, "")
    .replace(/[.,!?]+$/g, "")
    .trim();

  if (
    !fileName ||
    /^(?:dokumen|file)?\s*(?:ini|terakhir|yang sama)$/i
      .test(fileName)
  ) {
    return (
      documentContext?.shortCode ||
      documentContext?.documentCode ||
      ""
    );
  }

  return fileName;
}


function isDirectDocumentDeleteCommand(text) {
  const normalized = text.trim();

  return (
    /^(?:tolong\s+)?(?:hapus|delete)\b/i
      .test(normalized) ||
    /^(?:DOC-[A-Z0-9]+|[A-Z]{3}-\d{6}-\d{2})\s*,?\s*(?:hapus|delete)$/i
      .test(normalized)
  );
}


async function processConfirmationCommand({
  role,
  actorId,
  text,
}) {
  const confirmationPattern =
    /^!confirm\s+([0-9a-fA-F-]{36})\s+([A-Za-z0-9_-]{32,200})\s*$/;

  const match = text.trim().match(
    confirmationPattern,
  );

  if (!match) {
    return [
      "Format konfirmasi tidak valid.",
      "",
      "Gunakan:",
      "!confirm <action_id> <token>",
    ].join("\n");
  }

  const [, actionId, confirmationToken] = match;

  const skillResponse = await executeSkill({
    skill: "confirm_delete_client",
    role,
    actorId,
    parameters: {
      database_id: "leafy_core",
      action_id: actionId.toLowerCase(),
      confirmation_token: confirmationToken,
    },
  });

  return formatDeleteResult(skillResponse.result);
}


async function processMessage({
  senderJid,
  text,
  documentContext = null,
  messageContext = null,
  onDocumentDeleted = null,
}) {
  const role = resolveRole(senderJid);
  const actorId = createActorId(senderJid);
  const normalizedText = text.trim();

  if (
    normalizedText
      .toLowerCase()
      .startsWith("!confirm")
  ) {
    return processConfirmationCommand({
      role,
      actorId,
      text: normalizedText,
    });
  }

  if (isDirectDocumentDeleteCommand(normalizedText)) {
    const documentReference =
      resolveDocumentDeleteReference(
        normalizedText,
        documentContext,
      );

    if (!documentReference) {
      return (
        "Sebutkan kode atau nama dokumen yang ingin dihapus."
      );
    }

    const deleteResponse = await executeSkill({
      skill: "delete_document",
      role,
      actorId,
      parameters: {
        database_id: "leafy_core",
        document_reference: documentReference,
      },
    });

    if (typeof onDocumentDeleted === "function") {
      onDocumentDeleted(
        deleteResponse.result.document,
      );
    }

    return formatDocumentDeleteResult(
      deleteResponse.result,
    );
  }

  let rawPlan;

  try {
    rawPlan = await createPlan({
      message: text,
      role,
      documentContext,
      messageContext,
    });
  } catch (error) {
    console.error("Planner request failed:", {
      name: error.name,
    });
    throw new Error("Planner request failed");
  }

  console.log("Planner raw summary:", {
    action: rawPlan?.action || null,
    skill: rawPlan?.skill || null,
    parameterKeys:
      rawPlan?.parameters &&
      typeof rawPlan.parameters === "object"
        ? Object.keys(rawPlan.parameters)
        : [],
  });

  let plan;

  try {
    plan = validatePlan(rawPlan, role);
  } catch (error) {
    console.error("Planner validation failed:", {
      message: error.message,
    });
    throw new Error("Planner validation failed");
  }

  console.log("Planner result:", {
    action: plan.action,
    agent: plan.agent,
    skill: plan.skill || null,
    role,
  });

  if (plan.action === "reply") {
    return plan.reply;
  }

  const skillResponse = await executeSkill({
    skill: plan.skill,
    role,
    actorId,
    parameters: plan.parameters,
  });

  if (plan.skill === "preview_delete_client") {
    return formatDeletePreview(skillResponse.result);
  }

  if (
    plan.skill ===
    "preview_void_finance_transaction"
  ) {
    return formatFinanceVoidPreview(
      skillResponse.result,
    );
  }

  if (plan.skill === "delete_document") {
    if (typeof onDocumentDeleted === "function") {
      onDocumentDeleted(
        skillResponse.result.document,
      );
    }

    return formatDocumentDeleteResult(
      skillResponse.result,
    );
  }

  try {
    return await formatResult({
      originalMessage: text,
      skill: plan.skill,
      result: skillResponse.result,
    });
  } catch (error) {
    console.error("Formatter failed:", {
      name: error.name,
    });
    throw new Error("Formatter failed");
  }
}


module.exports = {
  processMessage,
};
