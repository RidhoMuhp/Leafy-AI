const path = require("path");
const {
  spawnSync,
} = require("child_process");
const {
  randomUUID,
} = require("crypto");

const { env } = require(
  "../src/config/env"
);

const {
  ingestDocument,
  executeSkill,
} = require(
  "../src/services/skillClient"
);

const {
  resolveRole,
} = require(
  "../src/services/permissionService"
);


const results = [];
let documentCode = null;


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
  const senderJid =
    env.superadminJids[0];

  if (!senderJid) {
    throw new Error(
      "SUPERADMIN_JIDS belum dikonfigurasi",
    );
  }

  const role = resolveRole(senderJid);

  const marker =
    `node-multipart-${randomUUID()}`;

  const fileName =
    `node-multipart-${randomUUID()}.txt`;

  const buffer = Buffer.from(
    [
      "Dokumen pengujian multipart Leafy AI.",
      `Marker unik: ${marker}`,
      "Dokumen ini menguji alur Node ke FastAPI.",
    ].join("\n"),
    "utf-8",
  );

  const uploadResponse =
    await ingestDocument({
      role,
      databaseId: "leafy_core",
      fileName,
      mimeType: "text/plain",
      buffer,
    });

  record(
    "Upload success",
    true,
    uploadResponse.success,
  );

  record(
    "Upload operation",
    "ingest_document",
    uploadResponse.operation,
  );

  record(
    "Document ingested",
    true,
    uploadResponse.result.ingested,
  );

  record(
    "Extraction method",
    "text",
    uploadResponse.result
      .extraction_method,
  );

  record(
    "Original filename",
    fileName,
    uploadResponse.result
      .document.original_name,
  );

  record(
    "Document status",
    "processed",
    uploadResponse.result
      .document.status,
  );

  record(
    "Chunk created",
    true,
    uploadResponse.result.chunk_count >= 1,
  );

  documentCode =
    uploadResponse.result
      .document.document_code;

  record(
    "Document code generated",
    true,
    /^DOC-[A-Z0-9]{20}$/.test(
      documentCode,
    ),
  );


  const searchResponse =
    await executeSkill({
      skill: "search_knowledge",
      role,
      actorId: null,
      parameters: {
        database_id: "leafy_core",
        search_text: marker,
        limit: 5,
        offset: 0,
      },
    });

  record(
    "Search success",
    true,
    searchResponse.success,
  );

  const searchResults =
    searchResponse.result.results;

  record(
    "Search finds document",
    true,
    searchResults.some(
      (item) =>
        item.document_code
        === documentCode,
    ),
  );

  record(
    "Search finds marker",
    true,
    searchResults.some(
      (item) =>
        item.snippet.includes(marker),
    ),
  );


  let duplicateRejected = false;

  try {
    await ingestDocument({
      role,
      databaseId: "leafy_core",
      fileName:
        `duplicate-${fileName}`,
      mimeType: "text/plain",
      buffer,
    });
  } catch (error) {
    duplicateRejected =
      error.code
      === "DUPLICATE_DOCUMENT";
  }

  record(
    "Duplicate rejected",
    true,
    duplicateRejected,
  );


  let userRejected = false;

  try {
    await ingestDocument({
      role: "user",
      databaseId: "leafy_core",
      fileName:
        `user-${fileName}`,
      mimeType: "text/plain",
      buffer: Buffer.from(
        `different-${marker}`,
      ),
    });
  } catch (error) {
    userRejected =
      error.code
      === "DOCUMENT_ACCESS_DENIED";
  }

  record(
    "User role rejected",
    true,
    userRejected,
  );
}


function cleanup() {
  if (!documentCode) {
    return;
  }

  const skillServicePath =
    path.resolve(
      __dirname,
      "../../skill-service",
    );

  const pythonPath = path.join(
    skillServicePath,
    ".venv",
    "Scripts",
    "python.exe",
  );

  const cleanupScript = path.join(
    skillServicePath,
    "tests",
    "cleanup_document_fixture.py",
  );

  const cleanupResult = spawnSync(
    pythonPath,
    [
      cleanupScript,
      documentCode,
    ],
    {
      cwd: skillServicePath,
      encoding: "utf-8",
    },
  );

  record(
    "Cleanup exit code",
    0,
    cleanupResult.status,
  );

  record(
    "Cleanup completed",
    true,
    cleanupResult.stdout.includes(
      "Cleanup document fixture: PASS",
    ),
  );

  if (cleanupResult.status !== 0) {
    console.error(
        "Cleanup diagnostics:",
        {
        pythonPath,
        cleanupScript,
        status: cleanupResult.status,
        stdout: cleanupResult.stdout,
        stderr: cleanupResult.stderr,
        error:
            cleanupResult.error?.message
            || null,
        documentCode,
        },
    );
    }
}


main()
  .catch((error) => {
    console.error(
      "Multipart test failed:",
      {
        name: error.name,
        code:
          error.code ||
          "INTERNAL_ERROR",
        message: error.message,
      },
    );

    process.exitCode = 1;
  })
  .finally(() => {
    cleanup();

    console.log();
    console.log(
      "Test".padEnd(38)
      + "Expected".padEnd(20)
      + "Actual".padEnd(20)
      + "Pass",
    );

    console.log("-".repeat(82));

    for (const result of results) {
      console.log(
        result.name.padEnd(38)
        + String(
          result.expected,
        ).padEnd(20)
        + String(
          result.actual,
        ).padEnd(20)
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
  });