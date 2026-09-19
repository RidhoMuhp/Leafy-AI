const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === "") {
    return defaultValue;
  }

  return String(value).toLowerCase() === "true";
}

function parsePort(value, defaultValue) {
  const port = Number(value ?? defaultValue);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT tidak valid");
  }

  return port;
}

function parseJidList(value = "") {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || "development",
  port: parsePort(process.env.PORT, 3000),

  whatsappEnabled: parseBoolean(
    process.env.WHATSAPP_ENABLED,
    true,
  ),

  whatsappAuthPath: path.resolve(
    __dirname,
    "../../",
    process.env.WHATSAPP_AUTH_PATH ||
      "auth_info_baileys",
  ),

  groqApiKey: process.env.GROQ_API_KEY || "",
  groqModel:
    process.env.GROQ_MODEL ||
    "openai/gpt-oss-120b",

  skillServiceUrl:
    process.env.LEAFY_SKILL_SERVICE_URL ||
    "http://127.0.0.1:8000",

  internalKey:
    process.env.LEAFY_INTERNAL_KEY || "",

  adminJids: parseJidList(
    process.env.LEAFY_ADMIN_JIDS,
  ),

  superadminJids: parseJidList(
    process.env.LEAFY_SUPERADMIN_JIDS,
  ),
});

module.exports = { env };