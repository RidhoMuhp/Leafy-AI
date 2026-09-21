const { env } = require("../config/env");
const {
  normalizeJid,
} = require("../whatsapp/jidService");

const SKILLS = Object.freeze({

  

  get_daily_business_summary: {
    roles: ["admin", "superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      summary_date: {
        type: "string",
        required: false,
        pattern: /^\d{4}-\d{2}-\d{2}$/,
      },
    },
  },

  get_finance_transaction: {
    roles: ["admin", "superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      transaction_id: {
        type: "integer",
        min: 1,
      },
    },
  },

  preview_void_finance_transaction: {
    roles: ["superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      transaction_id: {
        type: "integer",
        min: 1,
      },
      reason: {
        type: "string",
      },
    },
  },

  record_outreach: {
    roles: ["admin", "superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      client_id: {
        type: "integer",
        min: 1,
      },
      channel: {
        type: "string",
        allowed: [
          "whatsapp",
          "phone",
          "email",
          "instagram",
          "linkedin",
          "other",
        ],
      },
      direction: {
        type: "string",
        required: false,
        allowed: ["outbound", "inbound"],
      },
      message_summary: {
        type: "string",
        required: false,
      },
      outcome: {
        type: "string",
        allowed: [
          "no_response",
          "replied",
          "interested",
          "follow_up",
          "converted",
          "not_interested",
          "invalid_contact",
        ],
      },
      contacted_at: {
        type: "string",
        required: false,
      },
      follow_up_at: {
        type: "string",
        required: false,
      },
    },
  },

  find_followups: {
    roles: ["admin", "superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      due_date: {
        type: "string",
        required: false,
        pattern: /^\d{4}-\d{2}-\d{2}$/,
      },
      city: {
        type: "string",
        required: false,
      },
      limit: {
        type: "integer",
        required: false,
        min: 1,
        max: 100,
      },
    },
  },

  service_status: {
    roles: ["user", "admin", "superadmin"],
    parameters: {},
  },

  list_tables: {
    roles: ["admin", "superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
    },
  },

  describe_table: {
    roles: ["admin", "superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      table_id: {
        type: "string",
        pattern: /^[a-z][a-z0-9_]{0,63}$/,
      },
    },
  },

  read_table: {
    roles: ["admin", "superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      table_id: {
        type: "string",
        pattern: /^[a-z][a-z0-9_]{0,63}$/,
      },
      limit: {
        type: "integer",
        required: false,
        min: 1,
        max: 100,
      },
      offset: {
        type: "integer",
        required: false,
        min: 0,
        max: 100000,
      },
    },
  },

  count_rows: {
    roles: ["admin", "superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      table_id: {
        type: "string",
        pattern: /^[a-z][a-z0-9_]{0,63}$/,
      },
    },
  },

  list_clients: {
    roles: ["admin", "superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      search: {
        type: "string",
        required: false,
      },
      status: {
        type: "string",
        required: false,
        pattern: /^[a-z][a-z0-9_-]{0,29}$/,
      },
      city: {
        type: "string",
        required: false,
      },
      limit: {
        type: "integer",
        required: false,
        min: 1,
        max: 100,
      },
      offset: {
        type: "integer",
        required: false,
        min: 0,
        max: 100000,
      },
    },
  },

  get_client: {
    roles: ["admin", "superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      client_id: {
        type: "integer",
        min: 1,
      },
    },
  },

  create_client: {
    roles: ["admin", "superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      client_code: {
        type: "string",
        pattern:
          /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/,
      },
      name: {
        type: "string",
        pattern: /^.{1,150}$/,
      },
      business_type: {
        type: "string",
        required: false,
        pattern: /^.{1,100}$/,
      },
      phone: {
        type: "string",
        required: false,
        pattern: /^.{1,30}$/,
      },
      email: {
        type: "string",
        required: false,
        pattern: /^.{3,255}$/,
      },
      city: {
        type: "string",
        required: false,
        pattern: /^.{1,100}$/,
      },
      source: {
        type: "string",
        required: false,
        pattern: /^.{1,100}$/,
      },
      status: {
        type: "string",
        required: false,
        allowed: [
          "prospect",
          "lead",
          "contacted",
          "follow_up",
          "qualified",
          "won",
          "lost",
        ],
      },
      notes: {
        type: "string",
        required: false,
      },
    },
  },

  update_client: {
    roles: ["admin", "superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      client_id: {
        type: "integer",
        min: 1,
      },
      name: {
        type: "string",
        required: false,
        pattern: /^.{1,150}$/,
      },
      business_type: {
        type: "string",
        required: false,
        pattern: /^.{1,100}$/,
      },
      phone: {
        type: "string",
        required: false,
        pattern: /^.{1,30}$/,
      },
      email: {
        type: "string",
        required: false,
        pattern: /^.{3,255}$/,
      },
      city: {
        type: "string",
        required: false,
        pattern: /^.{1,100}$/,
      },
      source: {
        type: "string",
        required: false,
        pattern: /^.{1,100}$/,
      },
      notes: {
        type: "string",
        required: false,
      },
    },
  },

  update_client_status: {
    roles: ["admin", "superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      client_id: {
        type: "integer",
        min: 1,
      },
      status: {
        type: "string",
        allowed: [
          "prospect",
          "lead",
          "contacted",
          "follow_up",
          "qualified",
          "won",
          "lost",
        ],
      },
    },
  },

  preview_delete_client: {
    roles: ["superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      client_id: {
        type: "integer",
        min: 1,
      },
    },
  },

  list_finance_categories: {
    roles: ["admin", "superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      transaction_type: {
        type: "string",
        required: false,
        allowed: ["income", "expense"],
      },
    },
  },

  record_income: {
    roles: ["admin", "superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      category_code: {
        type: "string",
        pattern: /^[a-z][a-z0-9_]{0,49}$/,
      },
      amount: {
        type: "number",
        min: 0.01,
        max: 9999999999999.99,
      },
      description: {
        type: "string",
      },
      transaction_date: {
        type: "string",
        required: false,
        pattern: /^\d{4}-\d{2}-\d{2}$/,
      },
      client_id: {
        type: "integer",
        required: false,
        min: 1,
      },
      counterparty: {
        type: "string",
        required: false,
      },
      payment_method: {
        type: "string",
        required: false,
        pattern: /^[a-z][a-z0-9_-]{0,29}$/,
      },
      reference_number: {
        type: "string",
        required: false,
      },
      notes: {
        type: "string",
        required: false,
      },
    },
  },

  record_expense: {
    roles: ["admin", "superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      category_code: {
        type: "string",
        pattern: /^[a-z][a-z0-9_]{0,49}$/,
      },
      amount: {
        type: "number",
        min: 0.01,
        max: 9999999999999.99,
      },
      description: {
        type: "string",
      },
      transaction_date: {
        type: "string",
        required: false,
        pattern: /^\d{4}-\d{2}-\d{2}$/,
      },
      client_id: {
        type: "integer",
        required: false,
        min: 1,
      },
      counterparty: {
        type: "string",
        required: false,
      },
      payment_method: {
        type: "string",
        required: false,
        pattern: /^[a-z][a-z0-9_-]{0,29}$/,
      },
      reference_number: {
        type: "string",
        required: false,
      },
      notes: {
        type: "string",
        required: false,
      },
    },
  },

  list_finance_transactions: {
    roles: ["admin", "superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      transaction_type: {
        type: "string",
        required: false,
        allowed: ["income", "expense"],
      },
      category_code: {
        type: "string",
        required: false,
        pattern: /^[a-z][a-z0-9_]{0,49}$/,
      },
      client_id: {
        type: "integer",
        required: false,
        min: 1,
      },
      status: {
        type: "string",
        required: false,
        allowed: ["posted", "void"],
      },
      start_date: {
        type: "string",
        required: false,
        pattern: /^\d{4}-\d{2}-\d{2}$/,
      },
      end_date: {
        type: "string",
        required: false,
        pattern: /^\d{4}-\d{2}-\d{2}$/,
      },
      limit: {
        type: "integer",
        required: false,
        min: 1,
        max: 100,
      },
      offset: {
        type: "integer",
        required: false,
        min: 0,
        max: 100000,
      },
    },
  },

  get_finance_summary: {
    roles: ["admin", "superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      start_date: {
        type: "string",
        required: false,
        pattern: /^\d{4}-\d{2}-\d{2}$/,
      },
      end_date: {
        type: "string",
        required: false,
        pattern: /^\d{4}-\d{2}-\d{2}$/,
      },
    },
  },

  list_documents: {
    roles: ["admin", "superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      search: {
        type: "string",
        required: false,
        pattern: /^[\s\S]{1,200}$/,
      },
      status: {
        type: "string",
        required: false,
        allowed: ["processed"],
      },
      limit: {
        type: "integer",
        required: false,
        min: 1,
        max: 100,
      },
      offset: {
        type: "integer",
        required: false,
        min: 0,
        max: 100000,
      },
    },
  },

  get_document: {
    roles: ["admin", "superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      document_code: {
        type: "string",
        pattern:
          /^(?:DOC-[A-Z0-9]+|[A-Z]{3}-\d{6}-\d{2})$/,
      },
    },
  },

  delete_document: {
    roles: ["admin", "superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      document_reference: {
        type: "string",
        pattern: /^[^\r\n]{1,255}$/,
      },
    },
  },

  search_knowledge: {
    roles: ["admin", "superadmin"],
    parameters: {
      database_id: {
        type: "string",
        allowed: ["leafy_core"],
      },
      search_text: {
        type: "string",
        pattern: /^[\s\S]{2,200}$/,
      },
      document_code: {
        type: "string",
        required: false,
        pattern:
          /^(?:DOC-[A-Z0-9]+|[A-Z]{3}-\d{6}-\d{2})$/,
      },
      limit: {
        type: "integer",
        required: false,
        min: 1,
        max: 20,
      },
      offset: {
        type: "integer",
        required: false,
        min: 0,
        max: 10000,
      },
    },
  },
});

const AGENT_SKILLS = Object.freeze({
  system: Object.freeze([
    "service_status",
    "list_tables",
    "describe_table",
    "read_table",
    "count_rows",
  ]),

  management: Object.freeze([
    "list_clients",
    "get_client",
    "create_client",
    "update_client",
    "update_client_status",
    "record_outreach",
    "find_followups",
    "preview_delete_client",
    "get_daily_business_summary",
  ]),

  finance: Object.freeze([
    "list_finance_categories",
    "record_income",
    "record_expense",
    "list_finance_transactions",
    "get_finance_transaction",
    "get_finance_summary",
    "preview_void_finance_transaction",
  ]),

  document: Object.freeze([
    "list_documents",
    "get_document",
    "search_knowledge",
    "delete_document",
  ]),
});


function buildSkillAgentLookup() {
  const lookup = {};

  for (const [
    agent,
    skillNames,
  ] of Object.entries(AGENT_SKILLS)) {
    for (const skillName of skillNames) {
      if (!SKILLS[skillName]) {
        throw new Error(
          `Skill '${skillName}' pada agent '${agent}' tidak terdaftar`,
        );
      }

      if (lookup[skillName]) {
        throw new Error(
          `Skill '${skillName}' memiliki lebih dari satu agent`,
        );
      }

      lookup[skillName] = agent;
    }
  }

  for (const skillName of Object.keys(SKILLS)) {
    if (!lookup[skillName]) {
      throw new Error(
        `Skill '${skillName}' belum memiliki agent`,
      );
    }
  }

  return Object.freeze(lookup);
}


const SKILL_AGENT_LOOKUP =
  buildSkillAgentLookup();


function getSkillAgent(skillName) {
  const agent =
    SKILL_AGENT_LOOKUP[skillName];

  if (!agent) {
    throw new Error(
      "Agent skill tidak ditemukan",
    );
  }

  return agent;
}

const FORBIDDEN_KEYS = new Set([
  "query",
  "sql",
  "raw_sql",
  "connection_string",
  "connectionstring",
  "database_url",
  "password",
  "api_key",
  "internal_key",
]);

function resolveRole(senderJid) {
  const normalized = normalizeJid(senderJid);

  const superadmins = env.superadminJids
    .map(normalizeJid)
    .filter(Boolean);

  const admins = env.adminJids
    .map(normalizeJid)
    .filter(Boolean);

  if (superadmins.includes(normalized)) {
    return "superadmin";
  }

  if (admins.includes(normalized)) {
    return "admin";
  }

  return "user";
}

function containsForbiddenKey(value) {
  if (Array.isArray(value)) {
    return value.some(containsForbiddenKey);
  }

  if (
    value === null ||
    typeof value !== "object"
  ) {
    return false;
  }

  return Object.entries(value).some(
    ([key, nestedValue]) =>
      FORBIDDEN_KEYS.has(key.toLowerCase()) ||
      containsForbiddenKey(nestedValue),
  );
}

function validateField(name, value, definition) {
  if (value === undefined || value === null) {
    if (definition.required !== false) {
      throw new Error(
        `Parameter '${name}' wajib diisi`,
      );
    }

    return;
  }

  if (
    definition.type === "string" &&
    typeof value !== "string"
  ) {
    throw new Error(
      `Parameter '${name}' harus berupa teks`,
    );
  }

  if (
    definition.type === "integer" &&
    !Number.isInteger(value)
  ) {
    throw new Error(
      `Parameter '${name}' harus berupa bilangan bulat`,
    );
  }

  if (
    definition.type === "number" &&
    (
      typeof value !== "number" ||
      !Number.isFinite(value)
    )
  ) {
    throw new Error(
      `Parameter '${name}' harus berupa angka`,
    );
  }

  if (
    definition.allowed &&
    !definition.allowed.includes(value)
  ) {
    throw new Error(
      `Nilai parameter '${name}' tidak diizinkan`,
    );
  }

  if (
    definition.pattern &&
    !definition.pattern.test(value)
  ) {
    throw new Error(
      `Format parameter '${name}' tidak valid`,
    );
  }

  if (
    definition.min !== undefined &&
    value < definition.min
  ) {
    throw new Error(
      `Parameter '${name}' terlalu kecil`,
    );
  }

  if (
    definition.max !== undefined &&
    value > definition.max
  ) {
    throw new Error(
      `Parameter '${name}' terlalu besar`,
    );
  }
}

function validatePlan(plan, role) {
  if (
    !plan ||
    typeof plan !== "object" ||
    Array.isArray(plan)
  ) {
    throw new Error("Rencana AI tidak valid");
  }

  if (plan.action === "reply") {
    if (
      typeof plan.reply !== "string" ||
      plan.reply.trim() === ""
    ) {
      throw new Error("Balasan AI tidak valid");
    }

    return {
      action: "reply",
      agent: "conversation",
      reply: plan.reply.trim(),
    };
  }

  if (plan.action !== "skill") {
    throw new Error("Action AI tidak diizinkan");
  }

  const definition = SKILLS[plan.skill];

  if (!definition) {
    throw new Error("Skill tidak diizinkan");
  }

  if (!definition.roles.includes(role)) {
    throw new Error("Role tidak diizinkan");
  }

  const rawParameters = plan.parameters ?? {};

  if (
    typeof rawParameters !== "object" ||
    Array.isArray(rawParameters)
  ) {
    throw new Error("Parameter tidak diizinkan");
  }

  const parameters = Object.fromEntries(
    Object.entries(rawParameters)
      .filter(([name, value]) => {
        const field =
          definition.parameters[name];

        if (
          value === null ||
          value === undefined
        ) {
          return false;
        }

        if (
          typeof value === "string" &&
          value.trim() === "" &&
          field?.required === false
        ) {
          return false;
        }

        return true;
      })
      .map(([name, value]) => [
        name,
        typeof value === "string"
          ? value.trim()
          : value,
      ]),
  );

  if (containsForbiddenKey(parameters)) {
    throw new Error("Parameter tidak diizinkan");
  }

  const allowedNames = Object.keys(
    definition.parameters,
  );

  for (
    const suppliedName of Object.keys(parameters)
  ) {
    if (!allowedNames.includes(suppliedName)) {
      throw new Error(
        `Parameter '${suppliedName}' tidak diizinkan`,
      );
    }
  }

  for (const [name, field] of Object.entries(
    definition.parameters,
  )) {
    validateField(
      name,
      parameters[name],
      field,
    );
  }

  return {
    action: "skill",
    agent: getSkillAgent(plan.skill),
    skill: plan.skill,
    parameters,
  };
}

function getPlannerCatalog(role) {
  return Object.entries(SKILLS)
    .filter(([, definition]) =>
      definition.roles.includes(role),
    )
    .map(([name, definition]) => ({
      name,
      agent: getSkillAgent(name),
      parameters: Object.fromEntries(
        Object.entries(
          definition.parameters,
        ).map(
          ([parameterName, parameter]) => [
            parameterName,
            {
              type: parameter.type,
              required:
                parameter.required !== false,
              allowed:
                parameter.allowed || undefined,
              min: parameter.min,
              max: parameter.max,
              pattern:
                parameter.pattern?.source,
            },
          ],
        ),
      ),
    }));
}

function getAgentCatalog(role) {
  return Object.entries(AGENT_SKILLS)
    .map(([agent, skillNames]) => ({
      agent,
      skills: skillNames.filter(
        (skillName) =>
          SKILLS[
            skillName
          ].roles.includes(role),
      ),
    }))
    .filter(
      (item) => item.skills.length > 0,
    );
}

module.exports = {
  resolveRole,
  validatePlan,
  getPlannerCatalog,
  getAgentCatalog,
  getSkillAgent,
};
