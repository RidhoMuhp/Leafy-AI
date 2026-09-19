const path = require("path");
const pino = require("pino");
const qrcode = require("qrcode-terminal");

const {
  Browsers,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeWASocket,
  useMultiFileAuthState,
} = require("@whiskeysockets/baileys");

const {
  getMessageIdentity,
  getSocketIdentity,
} = require("./jidService");

const {
  extractAttachmentMetadata,
  extractText,
} = require("./messageService");

const { shouldProcessMessage } = require("./groupPolicy");

const logger = pino({
  level: process.env.WHATSAPP_LOG_LEVEL || "warn",
});

const MAX_ATTACHMENT_SIZE =15 * 1024 * 1024;
class WhatsAppService {
  constructor({ authPath, onMessage }) {
    this.authPath = path.resolve(authPath);
    this.onMessage = onMessage;
    this.socket = null;
    this.botIdentity = {
      primaryJid: null,
      lid: null,
    };

    this.stopping = false;
    this.connecting = false;
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
  }

  async start() {
    if (this.connecting || this.socket) {
      return;
    }

    this.stopping = false;
    this.connecting = true;

    try {
      const { state, saveCreds } =
        await useMultiFileAuthState(this.authPath);

      const { version } =
        await fetchLatestBaileysVersion();

      const socket = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(
            state.keys,
            logger,
          ),
        },
        browser: Browsers.ubuntu("Leafy AI"),
        logger,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
      });

      this.socket = socket;

      socket.ev.on("creds.update", saveCreds);

      socket.ev.on(
        "connection.update",
        (update) => this.handleConnectionUpdate(update),
      );

      socket.ev.on(
        "messages.upsert",
        (event) => this.handleMessages(event),
      );
    } finally {
      this.connecting = false;
    }
  }

  handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(
        "\nScan QR berikut dari WhatsApp > Perangkat tertaut:",
      );

      qrcode.generate(qr, {
        small: true,
      });
    }

    if (connection === "open") {
      this.reconnectAttempt = 0;
      this.botIdentity = getSocketIdentity(this.socket);

      console.log("WhatsApp terhubung.");
      console.log(
        "WhatsApp primary JID:",
        this.botIdentity.primaryJid || "tidak tersedia",
      );
      console.log(
        "WhatsApp LID:",
        this.botIdentity.lid || "tidak tersedia",
      );
    }

    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode ||
        lastDisconnect?.error?.statusCode;

      this.socket = null;

      if (
        statusCode === DisconnectReason.loggedOut
      ) {
        console.error(
          "Session WhatsApp logout. Login ulang diperlukan.",
        );

        return;
      }

      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.stopping || this.reconnectTimer) {
      return;
    }

    this.reconnectAttempt += 1;

    const delay = Math.min(
      30000,
      1000 * 2 ** Math.min(this.reconnectAttempt, 5),
    );

    console.log(
      `WhatsApp reconnect dalam ${delay / 1000} detik.`,
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;

      try {
        await this.start();
      } catch (error) {
        logger.error(
          { err: error },
          "WhatsApp reconnect gagal",
        );

        this.scheduleReconnect();
      }
    }, delay);
  }

  async handleMessages(event) {
    if (event.type !== "notify") {
      return;
    }

    for (const message of event.messages || []) {
      try {
        const identity = getMessageIdentity(message);

        if (!identity || identity.fromMe) {
          continue;
        }

        const text = extractText(message);

        const attachment =
          extractAttachmentMetadata(message);

        if (!text && !attachment) {
          continue;
        }

        const allowed = shouldProcessMessage({
          message,
          identity,
          text,
          botIdentity: this.botIdentity,
        });

        if (!allowed) {
          continue;
        }

        console.log("Pesan WhatsApp diterima:", {
          messageId: identity.messageId,
          chatJid: identity.chatJid,
          senderJid: identity.senderJid,
          isGroup: identity.isGroup,
        });

        await this.onMessage({
          socket: this.socket,
          message,
          identity,
          text,
          attachment,
          downloadAttachment: () =>
            this.downloadAttachment(
              message,
              attachment,
            ),
          withTyping: (task) =>
            this.withTyping(
              identity.chatJid,
              task,
            ),
        });
      } catch (error) {
        logger.error(
          { err: error },
          "Pemrosesan pesan WhatsApp gagal",
        );
      }
    }
  }

  async downloadAttachment(
    message,
    attachment,
  ) {
    if (!this.socket) {
      throw new Error(
        "WhatsApp belum terhubung",
      );
    }

    if (!attachment) {
      throw new Error(
        "Lampiran tidak ditemukan",
      );
    }

    if (
      attachment.fileLength >
      MAX_ATTACHMENT_SIZE
    ) {
      const error = new Error(
        "Ukuran lampiran melebihi batas 15 MB.",
      );

      error.name = "PublicDocumentError";
      error.code = "ATTACHMENT_TOO_LARGE";
      error.isPublic = true;

      throw error;
    }

    const buffer = await downloadMediaMessage(
      message,
      "buffer",
      {},
      {
        logger,
        reuploadRequest:
          this.socket.updateMediaMessage,
      },
    );

    if (!Buffer.isBuffer(buffer)) {
      throw new Error(
        "Hasil unduhan lampiran tidak valid",
      );
    }

    if (buffer.length > MAX_ATTACHMENT_SIZE) {
      const error = new Error(
        "Ukuran lampiran melebihi batas 15 MB.",
      );

      error.name = "PublicDocumentError";
      error.code = "ATTACHMENT_TOO_LARGE";
      error.isPublic = true;

      throw error;
    }

    return buffer;
  }

  async sendText(chatJid, text, quotedMessage = null) {
    if (!this.socket) {
      throw new Error("WhatsApp belum terhubung");
    }

    const options = quotedMessage
      ? { quoted: quotedMessage }
      : {};

    return this.socket.sendMessage(
      chatJid,
      { text },
      options,
    );
  }

  async withTyping(chatJid, task) {
    if (!this.socket) {
      throw new Error("WhatsApp belum terhubung");
    }

    try {
      await this.socket.presenceSubscribe(chatJid);
      await this.socket.sendPresenceUpdate(
        "composing",
        chatJid,
      );

      const typingInterval = setInterval(() => {
        this.socket
          ?.sendPresenceUpdate("composing", chatJid)
          .catch(() => {});
      }, 8000);

      try {
        return await task();
      } finally {
        clearInterval(typingInterval);
      }
    } finally {
      if (this.socket) {
        await this.socket
          .sendPresenceUpdate("paused", chatJid)
          .catch(() => {});
      }
    }
  }

  async stop() {
    this.stopping = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.end(
        new Error("Leafy AI dihentikan"),
      );

      this.socket = null;
    }
  }
}

module.exports = { WhatsAppService };