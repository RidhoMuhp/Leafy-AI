const { env } = require("./config/env");
const { createApp } = require("./index");
const {
  WhatsAppService,
} = require("./whatsapp/whatsappService");
const {
  processMessage,
} = require("./services/agentService");

const {
  isImportConfirmation,
  processImportConfirmation,
} = require(
  "./services/clientImportAgentService"
);

const {
  processKnowledgeAttachment,
} = require(
  "./services/knowledgeDocumentAgentService"
);

const {
  isFinanceVoidConfirmation,
  processFinanceVoidConfirmation,
} = require("./services/financeVoidService");

const app = createApp();

const httpServer = app.listen(
  env.port,
  "127.0.0.1",
  () => {
    console.log(
      `Leafy Node aktif di http://127.0.0.1:${env.port}`,
    );
  },
);

let whatsappService = null;
let shuttingDown = false;

async function handleWhatsAppMessage({
  socket,
  message,
  identity,
  text,
  attachment,
  downloadAttachment,
  withTyping,
}) {
  if (
    !attachment &&
    text.toLowerCase() === "!ping"
  ) {
    await socket.sendMessage(
      identity.chatJid,
      {
        text: "Leafy AI aktif.",
      },
      {
        quoted: message,
      },
    );

    return;
  }

  await withTyping(async () => {
    try {
      let response;

      if (attachment) {
        response = await processKnowledgeAttachment({
          senderJid: identity.senderJid,
          attachment,
          downloadAttachment,
        });
      } else if (
        isImportConfirmation(text)
      ) {
        response =
          await processImportConfirmation({
            senderJid: identity.senderJid,
            text,
          });
      } else if (
        isFinanceVoidConfirmation(text)
      ) {
        response =
          await processFinanceVoidConfirmation({
            senderJid: identity.senderJid,
            text,
          });

      } else {
        response = await processMessage({
          senderJid: identity.senderJid,
          text,
        });
      }

      await socket.sendMessage(
        identity.chatJid,
        {
          text: response,
        },
        {
          quoted: message,
        },
      );
    } catch (error) {
      console.error(
        "Agent processing failed:",
        {
          name: error.name,
          code:
            error.code ||
            "INTERNAL_ERROR",
        },
      );

      const responseMessage =
        error.isPublic === true
          ? error.message
          : "Maaf, permintaan belum dapat diproses.";

      await socket.sendMessage(
        identity.chatJid,
        {
          text: responseMessage,
        },
        {
          quoted: message,
        },
      );
    }
  });
}

async function startWhatsApp() {
  if (!env.whatsappEnabled) {
    console.log("WhatsApp dinonaktifkan melalui konfigurasi.");
    return;
  }

  whatsappService = new WhatsAppService({
    authPath: env.whatsappAuthPath,
    onMessage: handleWhatsAppMessage,
  });

  await whatsappService.start();
}

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`Menutup Leafy AI karena ${signal}.`);

  try {
    if (whatsappService) {
      await whatsappService.stop();
    }
  } finally {
    httpServer.close(() => {
      process.exit(0);
    });

    setTimeout(() => {
      process.exit(1);
    }, 5000).unref();
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startWhatsApp().catch((error) => {
  console.error(
    "WhatsApp gagal dimulai:",
    error.message,
  );
});