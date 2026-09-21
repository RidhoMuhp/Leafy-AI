const { createActorId } = require("./actorService");
const { resolveRole } = require("./permissionService");
const {
  executeSkill,
  ingestDocument,
  PublicAgentError,
} = require("./skillClient");
const {
  detectFinancialTransaction,
} = require("./transactionOcrService");


function formatWitaDateTime(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return (
    new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Makassar",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date) + " WITA"
  );
}


function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}


function formatTransactionType(value) {
  return value === "income"
    ? "Pemasukan"
    : "Pengeluaran";
}


function buildTransactionParameters({
  detectedTransaction,
  document,
}) {
  const parameters = {
    database_id: "leafy_core",
    category_code:
      detectedTransaction.categoryCode,
    amount: detectedTransaction.amount,
    description:
      detectedTransaction.description,
    notes: `Sumber dokumen ${
      document.short_code ||
      document.document_code
    }`,
  };

  const optionalFields = {
    transaction_date:
      detectedTransaction.transactionDate,
    counterparty:
      detectedTransaction.counterparty,
    reference_number:
      detectedTransaction.referenceNumber,
    payment_method:
      detectedTransaction.paymentMethod,
  };

  for (const [name, value] of Object.entries(
    optionalFields,
  )) {
    if (value !== null && value !== undefined && value !== "") {
      parameters[name] = value;
    }
  }

  return parameters;
}


async function recordDetectedTransaction({
  detectedTransaction,
  document,
  role,
  actorId,
}) {
  if (!detectedTransaction) return null;

  const skill =
    detectedTransaction.transactionType === "income"
      ? "record_income"
      : "record_expense";

  const response = await executeSkill({
    skill,
    role,
    actorId,
    parameters: buildTransactionParameters({
      detectedTransaction,
      document,
    }),
  });

  return response.result;
}


function formatDocumentMessage({
  result,
  detectedTransaction,
  recordedTransaction,
  transactionError,
  messageTimestamp,
}) {
  const document = result.document;
  const displayCode =
    document.short_code ||
    document.document_code;

  const lines = [
    "*Dokumen berhasil diproses*",
    "",
    `Kode: ${displayCode}`,
    `Nama: ${document.original_name}`,
    `Jenis: ${document.mime_type}`,
    `Metode: ${result.extraction_method}`,
  ];

  const sentAt = formatWitaDateTime(
    messageTimestamp,
  );
  if (sentAt) lines.push(`Dikirim: ${sentAt}`);

  if (detectedTransaction) {
    lines.push(
      "",
      "*Transaksi terdeteksi*",
      `Tipe: ${formatTransactionType(
        detectedTransaction.transactionType,
      )}`,
      `Nominal: ${formatCurrency(
        detectedTransaction.amount,
      )}`,
      `Kategori: ${detectedTransaction.categoryCode}`,
      `Deskripsi: ${detectedTransaction.description}`,
    );

    if (detectedTransaction.transactionDate) {
      lines.push(
        `Tanggal transaksi: ${detectedTransaction.transactionDate}`,
      );
    }
    if (detectedTransaction.counterparty) {
      lines.push(
        `Pihak terkait: ${detectedTransaction.counterparty}`,
      );
    }
    if (detectedTransaction.referenceNumber) {
      lines.push(
        `Referensi: ${detectedTransaction.referenceNumber}`,
      );
    }

    if (recordedTransaction) {
      lines.push(
        "",
        "Status transaksi: Berhasil dicatat.",
      );
    } else if (transactionError) {
      lines.push(
        "",
        "Status transaksi: Gagal dicatat otomatis.",
        "Dokumen tetap tersimpan sebagai knowledge.",
      );
    }
  } else if (result.preview) {
    lines.push(
      "",
      "*Preview*",
      result.preview.slice(0, 800),
    );
  }

  if (!transactionError) {
    lines.push(
      "",
      "Status dokumen: Tersimpan sebagai knowledge.",
    );
  }

  return lines.join("\n");
}


async function processKnowledgeAttachment({
  senderJid,
  attachment,
  downloadAttachment,
  messageTimestamp = null,
}) {
  const role = resolveRole(senderJid);
  const actorId = createActorId(senderJid);

  if (role !== "admin" && role !== "superadmin") {
    throw new PublicAgentError(
      "Anda tidak memiliki izin untuk menyimpan dokumen.",
      "DOCUMENT_ACCESS_DENIED",
    );
  }

  if (
    !attachment ||
    typeof downloadAttachment !== "function"
  ) {
    throw new PublicAgentError(
      "Lampiran tidak dapat diproses.",
      "INVALID_ATTACHMENT",
    );
  }

  const buffer = await downloadAttachment();
  const response = await ingestDocument({
    role,
    actorId,
    databaseId: "leafy_core",
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    buffer,
    messageTimestamp,
  });

  const result = response.result;
  const document = result.document;
  const extractedText =
    result.analysis_text ||
    result.extracted_text ||
    result.preview ||
    "";
  const detectedTransaction =
    detectFinancialTransaction(extractedText);

  let recordedTransaction = null;
  let transactionError = null;

  if (detectedTransaction) {
    try {
      recordedTransaction =
        await recordDetectedTransaction({
          detectedTransaction,
          document,
          role,
          actorId,
        });
    } catch (error) {
      transactionError = error;
      console.error(
        "Automatic transaction recording failed:",
        {
          name: error.name,
          code: error.code || "INTERNAL_ERROR",
          documentCode: document.document_code,
        },
      );
    }
  }

  return {
    message: formatDocumentMessage({
      result,
      detectedTransaction,
      recordedTransaction,
      transactionError,
      messageTimestamp,
    }),
    transactionRecorded:
      recordedTransaction !== null,
    documentContext: {
      documentCode: document.document_code,
      shortCode: document.short_code || null,
      documentType: document.document_type || null,
      originalName: document.original_name,
      mimeType: document.mime_type,
      extractionMethod: result.extraction_method,
      preview:
        result.preview?.slice(0, 1200) || "",
      detectedTransaction,
    },
  };
}


module.exports = {
  processKnowledgeAttachment,
};
