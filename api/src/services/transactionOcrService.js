const MONTHS = Object.freeze({
  januari: 1,
  january: 1,
  februari: 2,
  february: 2,
  maret: 3,
  march: 3,
  april: 4,
  mei: 5,
  may: 5,
  juni: 6,
  june: 6,
  juli: 7,
  july: 7,
  agustus: 8,
  august: 8,
  september: 9,
  oktober: 10,
  october: 10,
  november: 11,
  desember: 12,
  december: 12,
});

const EXPENSE_MARKERS = [
  "transfer berhasil",
  "transfer sukses",
  "pembayaran berhasil",
  "transaksi berhasil",
  "nama penerima",
  "bank tujuan",
  "rekening tujuan",
  "rekening debit",
  "kirim uang",
  "bayar",
  "debit",
];

const INCOME_MARKERS = [
  "dana masuk",
  "uang masuk",
  "pembayaran diterima",
  "transfer diterima",
  "nama pengirim",
  "rekening kredit",
  "dikreditkan",
  "penerimaan",
];

const AMOUNT_MARKERS = [
  "nominal",
  "jumlah",
  "total",
  "sebesar",
  "rp",
  "idr",
  "dibayar",
  "pembayaran",
  "transfer berhasil",
];

const EXCLUDED_AMOUNT_MARKERS = [
  "nomor referensi",
  "no referensi",
  "nomor rekening",
  "rekening tujuan",
  "rekening debit",
  "bizi id",
  "bizz id",
  "tanggal",
  "waktu",
];


function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}


function normalizeNumericOcr(value) {
  return String(value || "")
    .replace(/[OoQqD]/g, "0")
    .replace(/[Il|]/g, "1")
    .replace(/[Ss]/g, "5")
    .replace(/[Bb]/g, "8")
    .replace(/[Ee]/g, "0");
}


function normalizeForSearch(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[：:]/g, " ")
    .replace(/[^a-z0-9.,/\-\n ]+/g, " ")
    .replace(/[ ]+/g, " ")
    .trim();
}


function parseAmountToken(token) {
  const normalized = normalizeNumericOcr(token)
    .replace(/(?:rp|idr)/gi, "")
    .replace(/\s+/g, "")
    .replace(/[^0-9.,]/g, "");

  if (!normalized) return null;

  let integerText = normalized;
  const separators = normalized.match(/[.,]/g) || [];

  if (separators.length > 0) {
    const lastSeparator = Math.max(
      normalized.lastIndexOf("."),
      normalized.lastIndexOf(","),
    );
    const decimalLength =
      normalized.length - lastSeparator - 1;

    if (
      decimalLength === 2 &&
      separators.length === 1
    ) {
      integerText = normalized.slice(0, lastSeparator);
    }
  }

  const digits = integerText.replace(/\D/g, "");
  if (!digits || digits.length < 3 || digits.length > 14) {
    return null;
  }

  const amount = Number(digits);
  if (
    !Number.isSafeInteger(amount) ||
    amount < 100 ||
    amount > 9999999999999
  ) {
    return null;
  }

  return amount;
}


function getAmountCandidates(text) {
  const lines = normalizeWhitespace(text).split("\n");
  const candidates = [];

  lines.forEach((line, index) => {
    const normalizedLine = normalizeForSearch(line);
    const normalizedDigits = normalizeNumericOcr(line);
    const matches = normalizedDigits.match(
      /(?:rp|idr)?\s*\d[\dOoQqDdEeIl|SsBb., ]{2,24}/gi,
    ) || [];

    for (const token of matches) {
      const amount = parseAmountToken(token);
      if (amount === null) continue;

      let score = 0;
      if (/\b(?:rp|idr)\b/i.test(token)) score += 45;
      if (
        AMOUNT_MARKERS.some((marker) =>
          normalizedLine.includes(marker),
        )
      ) score += 35;
      if (
        EXPENSE_MARKERS.some((marker) =>
          normalizedLine.includes(marker),
        ) ||
        INCOME_MARKERS.some((marker) =>
          normalizedLine.includes(marker),
        )
      ) score += 15;
      if (/[.,]\d{3}(?:[.,]\d{3})*/.test(token)) {
        score += 15;
      }
      if (
        EXCLUDED_AMOUNT_MARKERS.some((marker) =>
          normalizedLine.includes(marker),
        )
      ) score -= 80;
      if (/\b20\d{2}\b/.test(token) && amount < 2100) {
        score -= 80;
      }

      candidates.push({
        amount,
        score,
        line,
        lineIndex: index,
        token: token.trim(),
      });
    }
  });

  return candidates.sort((left, right) =>
    right.score - left.score ||
    right.amount - left.amount,
  );
}


function countMarkers(text, markers) {
  return markers.reduce(
    (score, marker) =>
      score + (text.includes(marker) ? 1 : 0),
    0,
  );
}


function detectTransactionType(text) {
  const normalized = normalizeForSearch(text);
  const expenseScore = countMarkers(
    normalized,
    EXPENSE_MARKERS,
  );
  const incomeScore = countMarkers(
    normalized,
    INCOME_MARKERS,
  );

  if (expenseScore === 0 && incomeScore === 0) {
    return null;
  }

  if (incomeScore > expenseScore) {
    return {
      type: "income",
      score: incomeScore,
    };
  }

  return {
    type: "expense",
    score: expenseScore,
  };
}


function padNumber(value) {
  return String(value).padStart(2, "0");
}


function validIsoDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${padNumber(month)}-${padNumber(day)}`;
}


function extractTransactionDate(text) {
  const normalized = normalizeForSearch(text);

  const numericMatch = normalized.match(
    /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})\b/,
  );
  if (numericMatch) {
    return validIsoDate(
      Number(numericMatch[3]),
      Number(numericMatch[2]),
      Number(numericMatch[1]),
    );
  }

  const monthNames = Object.keys(MONTHS).join("|");
  const namedMatch = normalized.match(
    new RegExp(
      `\\b(\\d{1,2})[ \\/-]+(${monthNames})[ \\/-]+(20\\d{2})\\b`,
      "i",
    ),
  );
  if (!namedMatch) return null;

  return validIsoDate(
    Number(namedMatch[3]),
    MONTHS[namedMatch[2].toLowerCase()],
    Number(namedMatch[1]),
  );
}


function extractLabeledValue(text, labels) {
  const lines = normalizeWhitespace(text).split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const lowerLine = line.toLowerCase();
    const label = labels.find((item) =>
      lowerLine.includes(item),
    );
    if (!label) continue;

    const labelPosition = lowerLine.indexOf(label);
    const inlineValue = line
      .slice(labelPosition + label.length)
      .replace(/^[\s:：\-|]+/, "")
      .trim();

    if (inlineValue) return inlineValue;

    const nextLine = lines[index + 1]?.trim();
    if (nextLine) return nextLine;
  }

  return null;
}


function cleanPartyName(value) {
  if (!value) return null;

  const cleaned = value
    .replace(/[^A-Za-z0-9 .,'&()\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    cleaned.length < 3 ||
    cleaned.length > 100 ||
    /^\d+$/.test(cleaned)
  ) {
    return null;
  }

  return cleaned;
}


function extractCounterparty(text, transactionType) {
  const labels = transactionType === "income"
    ? ["nama pengirim", "dari", "sender"]
    : [
        "nama penerima",
        "penerima",
        "merchant",
        "tujuan transfer",
      ];

  return cleanPartyName(
    extractLabeledValue(text, labels),
  );
}


function extractReferenceNumber(text) {
  const value = extractLabeledValue(text, [
    "nomor referensi",
    "no referensi",
    "reference number",
    "ref no",
  ]);
  if (!value) return null;

  const match = normalizeNumericOcr(value).match(
    /[A-Z0-9][A-Z0-9\-/]{4,49}/i,
  );
  return match?.[0] || null;
}


function detectPaymentMethod(text) {
  const normalized = normalizeForSearch(text);

  if (normalized.includes("qris")) return "qris";
  if (normalized.includes("bi fast")) return "bank_transfer";
  if (normalized.includes("transfer")) return "bank_transfer";
  if (normalized.includes("kartu debit")) return "debit_card";
  if (normalized.includes("kartu kredit")) return "credit_card";
  if (normalized.includes("tunai")) return "cash";

  return null;
}


function detectCategory(text, transactionType) {
  const normalized = normalizeForSearch(text);

  if (transactionType === "income") {
    if (/\b(?:penjualan|produk|barang)\b/.test(normalized)) {
      return "sales";
    }
    if (/\b(?:jasa|service|dp|pelunasan)\b/.test(normalized)) {
      return "service_income";
    }
    if (/\b(?:modal|investasi)\b/.test(normalized)) {
      return "capital";
    }
    return "other_income";
  }

  if (/\b(?:internet|wifi|domain|hosting)\b/.test(normalized)) {
    return "internet";
  }
  if (/\b(?:transport|bensin|bbm|parkir|tol)\b/.test(normalized)) {
    return "transport";
  }
  if (/\b(?:laptop|komputer|printer|peralatan|equipment)\b/.test(normalized)) {
    return "equipment";
  }
  if (/\b(?:gaji|salary|upah)\b/.test(normalized)) {
    return "salary";
  }
  if (/\b(?:sewa|rent)\b/.test(normalized)) {
    return "rent";
  }
  if (/\b(?:iklan|ads|promosi|marketing)\b/.test(normalized)) {
    return "marketing";
  }
  if (/\b(?:operasional|listrik|air|atk)\b/.test(normalized)) {
    return "operations";
  }

  return "other_expense";
}


function buildDescription({
  transactionType,
  counterparty,
  paymentMethod,
}) {
  if (transactionType === "income") {
    return counterparty
      ? `Penerimaan dari ${counterparty}`
      : "Penerimaan berdasarkan bukti transaksi";
  }

  if (counterparty) {
    return `Pembayaran kepada ${counterparty}`;
  }

  if (paymentMethod === "bank_transfer") {
    return "Transfer berdasarkan bukti transaksi";
  }

  return "Pengeluaran berdasarkan bukti transaksi";
}


function detectFinancialTransaction(rawText) {
  const text = normalizeWhitespace(rawText);
  if (text.length < 8) return null;

  const typeResult = detectTransactionType(text);
  const amountCandidate = getAmountCandidates(text)[0];

  if (
    !typeResult ||
    !amountCandidate ||
    amountCandidate.score < 35
  ) {
    return null;
  }

  const transactionType = typeResult.type;
  const counterparty = extractCounterparty(
    text,
    transactionType,
  );
  const paymentMethod = detectPaymentMethod(text);
  const referenceNumber = extractReferenceNumber(text);
  const transactionDate = extractTransactionDate(text);
  const categoryCode = detectCategory(
    text,
    transactionType,
  );

  const confidence = Math.min(
    100,
    35 +
      Math.min(30, amountCandidate.score / 3) +
      Math.min(15, typeResult.score * 5) +
      (transactionDate ? 5 : 0) +
      (referenceNumber ? 5 : 0) +
      (counterparty ? 5 : 0) +
      (paymentMethod ? 5 : 0),
  );

  return {
    transactionType,
    amount: amountCandidate.amount,
    categoryCode,
    description: buildDescription({
      transactionType,
      counterparty,
      paymentMethod,
    }),
    transactionDate,
    counterparty,
    referenceNumber,
    paymentMethod,
    confidence: Math.round(confidence),
    evidence: {
      amountLine: amountCandidate.line,
      amountToken: amountCandidate.token,
    },
  };
}


module.exports = {
  detectFinancialTransaction,
};
