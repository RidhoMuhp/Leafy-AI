const { env } = require("../config/env");
const {
  normalizeJid,
} = require("../whatsapp/jidService");

const SKILLS = Object.freeze({


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
        ],
      },
      notes: {
        type: "string",
        required: false,
      },
    },
  },
});

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

module.exports = {
  resolveRole,
  validatePlan,
  getPlannerCatalog,
};