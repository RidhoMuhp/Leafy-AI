const { normalizeJid } = require("./jidService");
const { getMentionedJids } = require("./messageService");

function isValidCommand(text) {
  return /^![a-z][a-z0-9_-]{0,30}(?:\s|$)/i.test(text);
}

function isBotMentioned(message, botIdentity) {
  const botJids = new Set(
    [botIdentity.primaryJid, botIdentity.lid]
      .map(normalizeJid)
      .filter(Boolean),
  );

  return getMentionedJids(message)
    .map(normalizeJid)
    .some((jid) => botJids.has(jid));
}

function shouldProcessMessage({
  message,
  identity,
  text,
  botIdentity,
}) {
  if (!identity.isGroup) {
    return true;
  }

  return (
    isValidCommand(text) ||
    isBotMentioned(message, botIdentity)
  );
}

module.exports = {
  isValidCommand,
  isBotMentioned,
  shouldProcessMessage,
};