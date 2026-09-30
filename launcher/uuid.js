const crypto = require("crypto");

/**
 * Minecraft'ın offline-mode sunucularda kullandığı ile aynı yöntemle
 * kullanıcı adından deterministik bir UUID üretir:
 * UUID.nameUUIDFromBytes(("OfflinePlayer:" + username).getBytes(UTF-8))
 */
function offlineUUID(username) {
  const hash = crypto.createHash("md5").update("OfflinePlayer:" + username, "utf8").digest();
  hash[6] = (hash[6] & 0x0f) | 0x30; // version 3
  hash[8] = (hash[8] & 0x3f) | 0x80; // variant

  const hex = hash.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join("-");
}

module.exports = { offlineUUID };
