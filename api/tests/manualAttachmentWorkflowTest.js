const assert = require("assert");

const { env } = require(
  "../src/config/env"
);

const {
  extractAttachmentMetadata,
  extractText,
} = require(
  "../src/whatsapp/messageService"
);

const {
  resolveRole,
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


async function rejectsWithCode(
  callback,
  expectedCode,
) {
  try {
    await callback();
    return false;
  } catch (error) {
    return error.code === expectedCode;
  }
}


async function main() {
  const documentMessage = {
    key: {
      id: "DOCUMENT-MESSAGE-1",
    },
    message: {
      documentMessage: {
        fileName: "laporan-operasional.xlsx",
        mimetype:
          "application/vnd.openxmlformats-officedocument."
          + "spreadsheetml.sheet",
        fileLength: 4096,
        caption: "Laporan operasional",
      },
    },
  };

  const document =
    extractAttachmentMetadata(
      documentMessage,
    );

  record(
    "Document metadata available",
    true,
    document !== null,
  );

  record(
    "Document source type",
    "document",
    document?.sourceType,
  );

  record(
    "Document file name",
    "laporan-operasional.xlsx",
    document?.fileName,
  );

  record(
    "Document MIME type",
    "application/vnd.openxmlformats-officedocument."
      + "spreadsheetml.sheet",
    document?.mimeType,
  );

  record(
    "Document file length",
    4096,
    document?.fileLength,
  );

  record(
    "Document caption",
    "Laporan operasional",
    document?.caption,
  );

  record(
    "Document text extraction",
    "Laporan operasional",
    extractText(documentMessage),
  );


  const ephemeralDocumentMessage = {
    key: {
      id: "EPHEMERAL-DOCUMENT-1",
    },
    message: {
      ephemeralMessage: {
        message: {
          documentMessage: {
            fileName: "kebijakan.pdf",
            mimetype: "application/pdf",
            fileLength: {
              toString() {
                return "8192";
              },
            },
            caption: "",
          },
        },
      },
    },
  };

  const ephemeralDocument =
    extractAttachmentMetadata(
      ephemeralDocumentMessage,
    );

  record(
    "Ephemeral document detected",
    "kebijakan.pdf",
    ephemeralDocument?.fileName,
  );

  record(
    "Proto file length normalized",
    8192,
    ephemeralDocument?.fileLength,
  );


  const jpegMessage = {
    key: {
      id: "IMAGE-JPEG-ABC",
    },
    message: {
      imageMessage: {
        mimetype: "image/jpeg",
        fileLength: 2048,
        caption: "Foto invoice",
      },
    },
  };

  const jpegAttachment =
    extractAttachmentMetadata(
      jpegMessage,
    );

  record(
    "JPEG source type",
    "image",
    jpegAttachment?.sourceType,
  );

  record(
    "JPEG generated filename",
    "whatsapp-image-IMAGE-JPEG-ABC.jpg",
    jpegAttachment?.fileName,
  );

  record(
    "JPEG MIME type",
    "image/jpeg",
    jpegAttachment?.mimeType,
  );

  record(
    "JPEG caption",
    "Foto invoice",
    jpegAttachment?.caption,
  );


  const pngMessage = {
    key: {
      id: "IMAGE-PNG-ABC",
    },
    message: {
      imageMessage: {
        mimetype: "image/png",
        fileLength: 1024,
      },
    },
  };

  const pngAttachment =
    extractAttachmentMetadata(
      pngMessage,
    );

  record(
    "PNG generated filename",
    "whatsapp-image-IMAGE-PNG-ABC.png",
    pngAttachment?.fileName,
  );

  record(
    "PNG MIME type",
    "image/png",
    pngAttachment?.mimeType,
  );


  const textOnlyMessage = {
    key: {
      id: "TEXT-ONLY-1",
    },
    message: {
      conversation: "Halo Leafy",
    },
  };

  record(
    "Text has no attachment",
    null,
    extractAttachmentMetadata(
      textOnlyMessage,
    ),
  );

  record(
    "Text still extracted",
    "Halo Leafy",
    extractText(textOnlyMessage),
  );


  const authorizedSender =
    env.superadminJids[0]
    || env.adminJids[0];

  assert.ok(
    authorizedSender,
    "ADMIN_JIDS atau SUPERADMIN_JIDS "
      + "belum dikonfigurasi",
  );

  const expectedRole =
    resolveRole(authorizedSender);

  record(
    "Authorized role",
    true,
    (
      expectedRole === "admin"
      || expectedRole === "superadmin"
    ),
  );


  const skillClientPath = require.resolve(
    "../src/services/skillClient",
  );

  const knowledgeServicePath =
    require.resolve(
      "../src/services/"
      + "knowledgeDocumentAgentService",
    );

  const skillClient = require(
    skillClientPath
  );

  const originalIngestDocument =
    skillClient.ingestDocument;

  let capturedUpload = null;

  skillClient.ingestDocument =
    async (payload) => {
      capturedUpload = payload;

      return {
        success: true,
        operation: "ingest_document",
        result: {
          database_id: "leafy_core",
          document: {
            id: 999,
            document_code:
              "DOC-1234567890ABCDEFGHIJ",
            original_name:
              "laporan-operasional.xlsx",
            safe_name:
              "laporan-operasional.xlsx",
            mime_type:
              "application/vnd.openxmlformats-officedocument."
              + "spreadsheetml.sheet",
            file_size: 4096,
            status: "processed",
          },
          extraction_method: "xlsx",
          character_count: 2500,
          chunk_count: 2,
          preview: "Preview laporan",
          duplicate: false,
          ingested: true,
        },
      };
    };

  delete require.cache[
    knowledgeServicePath
  ];

  const {
    processKnowledgeAttachment,
  } = require(knowledgeServicePath);

  const fixtureBuffer = Buffer.from(
    "fake-xlsx-buffer-for-routing-test",
  );

  let downloadCalled = false;

  const response =
    await processKnowledgeAttachment({
      senderJid: authorizedSender,
      attachment: document,
      downloadAttachment: async () => {
        downloadCalled = true;
        return fixtureBuffer;
      },
    });

  record(
    "Attachment downloaded",
    true,
    downloadCalled,
  );

  record(
    "Upload role forwarded",
    expectedRole,
    capturedUpload?.role,
  );

  record(
    "Upload database forwarded",
    "leafy_core",
    capturedUpload?.databaseId,
  );

  record(
    "Upload filename forwarded",
    "laporan-operasional.xlsx",
    capturedUpload?.fileName,
  );

  record(
    "Upload MIME forwarded",
    document.mimeType,
    capturedUpload?.mimeType,
  );

  record(
    "Upload buffer forwarded",
    true,
    Buffer.isBuffer(
      capturedUpload?.buffer,
    )
      && capturedUpload.buffer.equals(
        fixtureBuffer,
      ),
  );

  record(
    "Response contains success",
    true,
    response.includes(
      "Dokumen berhasil diproses",
    ),
  );

  record(
    "Response contains code",
    true,
    response.includes(
      "DOC-1234567890ABCDEFGHIJ",
    ),
  );

  record(
    "Response contains XLSX method",
    true,
    response.includes("xlsx"),
  );

  record(
    "Response contains chunk count",
    true,
    response.includes(
      "Jumlah bagian: 2",
    ),
  );


  let unauthorizedSender =
    "6200000000000@s.whatsapp.net";

  if (
    resolveRole(unauthorizedSender)
    !== "user"
  ) {
    unauthorizedSender =
      "6299999999999@s.whatsapp.net";
  }

  record(
    "Unauthorized sender is user",
    "user",
    resolveRole(unauthorizedSender),
  );

  const userRejected =
    await rejectsWithCode(
      () =>
        processKnowledgeAttachment({
          senderJid:
            unauthorizedSender,
          attachment: document,
          downloadAttachment:
            async () => fixtureBuffer,
        }),
      "DOCUMENT_ACCESS_DENIED",
    );

  record(
    "User upload rejected",
    true,
    userRejected,
  );


  const invalidAttachmentRejected =
    await rejectsWithCode(
      () =>
        processKnowledgeAttachment({
          senderJid:
            authorizedSender,
          attachment: null,
          downloadAttachment: null,
        }),
      "INVALID_ATTACHMENT",
    );

  record(
    "Invalid attachment rejected",
    true,
    invalidAttachmentRejected,
  );


  skillClient.ingestDocument =
    originalIngestDocument;

  delete require.cache[
    knowledgeServicePath
  ];


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
      + String(
        result.expected,
      ).padEnd(22)
      + String(
        result.actual,
      ).padEnd(22)
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
    "Attachment workflow test failed:",
    {
      name: error.name,
      message: error.message,
    },
  );

  process.exitCode = 1;
});