const {
  createPlan,
} = require("./groqPlanner");

const {
  executeSkill,
} = require("./skillClient");

const {
  formatResult,
} = require("./groqFormatter");

const {
  resolveRole,
  validatePlan,
} = require("./permissionService");

const {
  createActorId,
} = require("./actorService");


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


async function processConfirmationCommand({
  senderJid,
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

  const [, actionId, confirmationToken] =
    match;

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

  return formatDeleteResult(
    skillResponse.result,
  );
}


async function processMessage({
  senderJid,
  text,
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
      senderJid,
      role,
      actorId,
      text: normalizedText,
    });
  }

  let rawPlan;

  try {
    rawPlan = await createPlan({
      message: text,
      role,
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
    console.error(
      "Planner validation failed:",
      {
        message: error.message,
      },
    );

    throw new Error(
      "Planner validation failed",
    );
  }

  console.log("Planner result:", {
    action: plan.action,
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

  if (
    plan.skill === "preview_delete_client"
  ) {
    return formatDeletePreview(
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