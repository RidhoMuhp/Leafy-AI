const {
  createPlan,
} = require(
  "../src/services/groqPlanner"
);

const {
  validatePlan,
} = require(
  "../src/services/permissionService"
);


const cases = [
  {
    name: "Daftar dokumen",
    message:
      "Tampilkan daftar dokumen yang tersedia.",
    expectedSkill: "list_documents",
  },
  {
    name: "Cari nama dokumen",
    message:
      "Cari dokumen yang namanya laporan stok.",
    expectedSkill: "list_documents",
  },
  {
    name: "Cari isi dokumen",
    message:
      "Cari informasi tentang invoice jatuh tempo "
      + "di dalam dokumen perusahaan.",
    expectedSkill: "search_knowledge",
  },
  {
    name: "Cari aturan approval",
    message:
      "Apa isi dokumen tentang approval manusia?",
    expectedSkill: "search_knowledge",
  },
  {
    name: "Detail document code",
    message:
      "Tampilkan detail dokumen "
      + "DOC-1234567890ABCDEFGHIJ.",
    expectedSkill: "get_document",
  },
];


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


async function main() {
  for (const testCase of cases) {
    try {
      const rawPlan = await createPlan({
        message: testCase.message,
        role: "admin",
      });

      const plan = validatePlan(
        rawPlan,
        "admin",
      );

      record(
        `${testCase.name} action`,
        "skill",
        plan.action,
      );

      record(
        `${testCase.name} skill`,
        testCase.expectedSkill,
        plan.skill,
      );

      record(
        `${testCase.name} agent`,
        "document",
        plan.agent,
      );

      record(
        `${testCase.name} database`,
        "leafy_core",
        plan.parameters.database_id,
      );

      if (
        plan.skill === "search_knowledge"
      ) {
        record(
          `${testCase.name} search_text`,
          true,
          (
            typeof (
              plan.parameters.search_text
            ) === "string"
            && plan.parameters.search_text
              .length >= 2
          ),
        );

        record(
          `${testCase.name} no query`,
          false,
          Object.hasOwn(
            plan.parameters,
            "query",
          ),
        );
      }

      console.log(
        `${testCase.name}:`,
        JSON.stringify(plan),
      );
    } catch (error) {
      record(
        `${testCase.name} execution`,
        "success",
        error.message,
      );
    }
  }

  console.log();
  console.log(
    "Test".padEnd(42)
    + "Expected".padEnd(22)
    + "Actual".padEnd(22)
    + "Pass",
  );
  console.log("-".repeat(90));

  for (const result of results) {
    console.log(
      result.name.padEnd(42)
      + String(result.expected).padEnd(22)
      + String(result.actual).padEnd(22)
      + String(result.passed),
    );
  }

  const passedCount = results.filter(
    (result) => result.passed,
  ).length;

  console.log();
  console.log(
    `Result: ${passedCount}/`
    + `${results.length} PASS`,
  );

  if (passedCount !== results.length) {
    process.exitCode = 1;
  }
}


main().catch((error) => {
  console.error(
    "Document planner test failed:",
    {
      name: error.name,
      message: error.message,
    },
  );

  process.exitCode = 1;
});