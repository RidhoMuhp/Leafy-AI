const {
  validatePlan,
  getPlannerCatalog,
  getAgentCatalog,
  getSkillAgent,
} = require(
  "../src/services/permissionService"
);


const results = [];


function record(
  name,
  expected,
  actual,
) {
  results.push({
    name,
    expected,
    actual,
    passed: expected === actual,
  });
}


function throwsError(callback) {
  try {
    callback();
    return false;
  } catch {
    return true;
  }
}


const adminCatalog =
  getPlannerCatalog("admin");

const adminSkillNames = adminCatalog.map(
  (item) => item.name,
);

record(
  "Admin catalog list_documents",
  true,
  adminSkillNames.includes(
    "list_documents",
  ),
);

record(
  "Admin catalog get_document",
  true,
  adminSkillNames.includes(
    "get_document",
  ),
);

record(
  "Admin catalog search_knowledge",
  true,
  adminSkillNames.includes(
    "search_knowledge",
  ),
);


const userCatalog =
  getPlannerCatalog("user");

const userSkillNames = userCatalog.map(
  (item) => item.name,
);

record(
  "User cannot list documents",
  false,
  userSkillNames.includes(
    "list_documents",
  ),
);

record(
  "User cannot get document",
  false,
  userSkillNames.includes(
    "get_document",
  ),
);

record(
  "User cannot search knowledge",
  false,
  userSkillNames.includes(
    "search_knowledge",
  ),
);


const agentCatalog =
  getAgentCatalog("admin");

const documentAgent = agentCatalog.find(
  (item) => item.agent === "document",
);

record(
  "Document agent available",
  true,
  Boolean(documentAgent),
);

record(
  "Document agent skill count",
  3,
  documentAgent?.skills.length || 0,
);

record(
  "list_documents agent",
  "document",
  getSkillAgent("list_documents"),
);

record(
  "get_document agent",
  "document",
  getSkillAgent("get_document"),
);

record(
  "search_knowledge agent",
  "document",
  getSkillAgent("search_knowledge"),
);


const listPlan = validatePlan(
  {
    action: "skill",
    skill: "list_documents",
    parameters: {
      database_id: "leafy_core",
      search: "laporan",
      limit: 10,
      offset: 0,
    },
  },
  "admin",
);

record(
  "List plan agent",
  "document",
  listPlan.agent,
);

record(
  "List plan skill",
  "list_documents",
  listPlan.skill,
);


const getPlan = validatePlan(
  {
    action: "skill",
    skill: "get_document",
    parameters: {
      database_id: "leafy_core",
      document_code:
        "DOC-1234567890ABCDEFGHIJ",
    },
  },
  "superadmin",
);

record(
  "Get plan agent",
  "document",
  getPlan.agent,
);


const searchPlan = validatePlan(
  {
    action: "skill",
    skill: "search_knowledge",
    parameters: {
      database_id: "leafy_core",
      search_text:
        "  invoice jatuh tempo  ",
      limit: 5,
    },
  },
  "admin",
);

record(
  "Search plan agent",
  "document",
  searchPlan.agent,
);

record(
  "Search text normalized",
  "invoice jatuh tempo",
  searchPlan.parameters.search_text,
);


record(
  "User role rejected",
  true,
  throwsError(() =>
    validatePlan(
      {
        action: "skill",
        skill: "search_knowledge",
        parameters: {
          database_id: "leafy_core",
          search_text: "invoice",
        },
      },
      "user",
    ),
  ),
);

record(
  "Forbidden query rejected",
  true,
  throwsError(() =>
    validatePlan(
      {
        action: "skill",
        skill: "search_knowledge",
        parameters: {
          database_id: "leafy_core",
          query: "SELECT data",
        },
      },
      "admin",
    ),
  ),
);

record(
  "Forbidden raw_sql rejected",
  true,
  throwsError(() =>
    validatePlan(
      {
        action: "skill",
        skill: "search_knowledge",
        parameters: {
          database_id: "leafy_core",
          search_text: "invoice",
          raw_sql:
            "SELECT * FROM knowledge_chunks",
        },
      },
      "admin",
    ),
  ),
);

record(
  "Unknown parameter rejected",
  true,
  throwsError(() =>
    validatePlan(
      {
        action: "skill",
        skill: "list_documents",
        parameters: {
          database_id: "leafy_core",
          unknown_field: "test",
        },
      },
      "admin",
    ),
  ),
);

record(
  "Invalid database rejected",
  true,
  throwsError(() =>
    validatePlan(
      {
        action: "skill",
        skill: "list_documents",
        parameters: {
          database_id: "other_database",
        },
      },
      "admin",
    ),
  ),
);

record(
  "Search limit rejected",
  true,
  throwsError(() =>
    validatePlan(
      {
        action: "skill",
        skill: "search_knowledge",
        parameters: {
          database_id: "leafy_core",
          search_text: "invoice",
          limit: 21,
        },
      },
      "admin",
    ),
  ),
);

record(
  "Invalid document code rejected",
  true,
  throwsError(() =>
    validatePlan(
      {
        action: "skill",
        skill: "get_document",
        parameters: {
          database_id: "leafy_core",
          document_code: "DOC-invalid",
        },
      },
      "admin",
    ),
  ),
);


console.log();
console.log(
  "Test".padEnd(40)
  + "Expected".padEnd(18)
  + "Actual".padEnd(18)
  + "Pass",
);
console.log("-".repeat(82));

for (const result of results) {
  console.log(
    result.name.padEnd(40)
    + String(result.expected).padEnd(18)
    + String(result.actual).padEnd(18)
    + String(result.passed),
  );
}

const passedCount = results.filter(
  (result) => result.passed,
).length;

console.log();
console.log(
  `Result: ${passedCount}/${results.length} PASS`,
);

if (passedCount !== results.length) {
  process.exitCode = 1;
}