const axios = require("axios");
const { env } = require("../config/env");

class PublicAgentError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "PublicAgentError";
    this.code = code;
    this.isPublic = true;
  }
}

const client = axios.create({
  baseURL: env.skillServiceUrl,
  timeout: 15000,
  headers: {
    "content-type": "application/json",
  },
});

const uploadClient = axios.create({
  baseURL: env.skillServiceUrl,
  timeout: 120000,
});

async function ingestDocument({
  role,
  databaseId,
  fileName,
  mimeType,
  buffer,
}) {
  if (!env.internalKey) {
    throw new Error(
      "Internal key belum dikonfigurasi",
    );
  }

  if (!Buffer.isBuffer(buffer)) {
    throw new Error(
      "Buffer dokumen tidak valid",
    );
  }

  const form = new FormData();

  form.append("role", role);
  form.append("database_id", databaseId);

  form.append(
    "file",
    new Blob(
      [buffer],
      {
        type:
          mimeType ||
          "application/octet-stream",
      },
    ),
    fileName || "document.bin",
  );

  try {
    const response = await uploadClient.post(
      "/documents/ingest",
      form,
      {
        headers: {
          "x-leafy-internal-key":
            env.internalKey,
        },
      },
    );

    return response.data;
  } catch (error) {
    const status = error.response?.status;

    console.error(
      "Document ingestion request failed:",
      {
        status: status || "unavailable",
      },
    );

    if (status === 422) {
      throw new PublicAgentError(
        "File tidak valid, tidak didukung, "
        + "atau tidak memiliki teks yang dapat dibaca.",
        "INVALID_DOCUMENT",
      );
    }

    if (status === 403) {
      throw new PublicAgentError(
        "Anda tidak memiliki izin "
        + "untuk menyimpan dokumen.",
        "DOCUMENT_ACCESS_DENIED",
      );
    }

    if (status === 409) {
      throw new PublicAgentError(
        "Dokumen yang sama sudah tersedia.",
        "DUPLICATE_DOCUMENT",
      );
    }

    if (status === 503) {
      throw new PublicAgentError(
        "Database sedang tidak dapat diakses.",
        "DATABASE_UNAVAILABLE",
      );
    }

    throw new Error(
      "Document ingestion service "
      + "tidak dapat diakses",
    );
  }
}

async function executeSkill({
  skill,
  role,
  actorId,
  parameters,
}) {
  if (!env.internalKey) {
    throw new Error(
      "Internal key belum dikonfigurasi",
    );
  }

  try {
    const response = await client.post(
      "/execute",
      {
        skill,
        role,
        actor_id: actorId,
        parameters,
      },
      {
        headers: {
          "x-leafy-internal-key":
            env.internalKey,
        },
      },
    );

    return response.data;
  } catch (error) {
    const status = error.response?.status;

    if (status === 422) {
      const validationDetail =
        error.response?.data?.detail;

      if (Array.isArray(validationDetail)) {
        console.error(
          "FastAPI validation summary:",
          validationDetail.map((item) => ({
            type: item.type,
            location: item.loc,
            message: item.msg,
          })),
        );
      } else {
        console.error(
          "FastAPI validation summary:",
          validationDetail,
        );
      }
    }
    console.error(
      "Skill service request failed:",
      {
        status: status || "unavailable",
        skill,
      },
    );

    if (status === 400 || status === 422) {
      throw new PublicAgentError(
        "Permintaan tersebut tidak valid.",
        "INVALID_SKILL_REQUEST",
      );
    }

    if (status === 403) {
      throw new PublicAgentError(
        "Anda tidak memiliki izin untuk permintaan tersebut.",
        "SKILL_ACCESS_DENIED",
      );
    }

    if (status === 404) {
      throw new PublicAgentError(
        skill === "get_client"
          ? "Klien tersebut tidak ditemukan."
          : "Data yang diminta tidak ditemukan.",
        "RESOURCE_NOT_FOUND",
      );
    }

    if (status === 409) {
      throw new PublicAgentError(
        "Operasi tidak dapat dilakukan karena data masih memiliki hubungan dengan data lain.",
        "RESOURCE_CONFLICT",
      );
    }

    if (status === 503) {
      throw new PublicAgentError(
        "Database sedang tidak dapat diakses.",
        "DATABASE_UNAVAILABLE",
      );
    }

    throw new Error(
      "Skill service tidak dapat diakses",
    );
  }
}

module.exports = {
  executeSkill,
  ingestDocument,
  PublicAgentError,
};