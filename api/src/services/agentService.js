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


async function processMessage({
  senderJid,
  text,
}) {
  const role = resolveRole(senderJid);

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
    console.error("Planner validation failed:", {
      message: error.message,
    });

    throw new Error("Planner validation failed");
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
    parameters: plan.parameters,
  });

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


module.exports = { processMessage };