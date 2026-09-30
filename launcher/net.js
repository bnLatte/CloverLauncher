const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

function sha1File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha1");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (d) => hash.update(d));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/**
 * Bir dosyayı verilen URL'den indirir. Dosya zaten varsa ve sha1 eşleşiyorsa
 * tekrar indirmez (önbellekleme). onProgress(bytesDownloaded, totalBytes) çağrılır.
 */
async function downloadFile(url, destPath, expectedSha1, onProgress) {
  if (fs.existsSync(destPath) && expectedSha1) {
    try {
      const existing = await sha1File(destPath);
      if (existing === expectedSha1) return { skipped: true };
    } catch (e) { /* dosya bozuksa yeniden indir */ }
  } else if (fs.existsSync(destPath) && !expectedSha1) {
    return { skipped: true };
  }

  ensureDir(destPath);
  const tmpPath = destPath + ".part";

  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tmpPath);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlink(tmpPath, () => {});
        downloadFile(res.headers.location, destPath, expectedSha1, onProgress).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`GET ${url} -> ${res.statusCode}`));
        return;
      }
      const total = parseInt(res.headers["content-length"] || "0", 10);
      let downloaded = 0;
      res.on("data", (chunk) => {
        downloaded += chunk.length;
        if (onProgress) onProgress(downloaded, total);
      });
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
      file.on("error", reject);
    }).on("error", reject);
  });

  fs.renameSync(tmpPath, destPath);
  return { skipped: false };
}

module.exports = { fetchJson, downloadFile, sha1File, ensureDir };
