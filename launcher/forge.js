const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { fetchJson, downloadFile } = require("./net");

const PROMOTIONS_URL = "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json";

async function getLatestForgeVersion(mcVersion) {
  const data = await fetchJson(PROMOTIONS_URL);
  const promos = data.promos || {};
  const forgeVersion = promos[`${mcVersion}-recommended`] || promos[`${mcVersion}-latest`];
  if (!forgeVersion) {
    throw new Error(`Bu Minecraft sürümü için Forge bulunamadı: ${mcVersion}`);
  }
  return forgeVersion;
}

/**
 * Forge'un KENDİ resmi installer .jar dosyasını indirir ve headless modda
 * çalıştırır (`java -jar installer.jar --installClient <dizin>`).
 * Bytecode yamalama mantığını biz yeniden yazmıyoruz; bunu tamamen Forge'un
 * kendi resmi aracı yapıyor. Kurulum bittiğinde oluşan versions/<id> klasörünün
 * adını döner, böylece onu normal bir sürüm gibi başlatabiliriz.
 */
async function installForge(mcVersion, gameDir, javaPath, onProgress) {
  const forgeVersion = await getLatestForgeVersion(mcVersion);
  const full = `${mcVersion}-${forgeVersion}`;
  const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${full}/forge-${full}-installer.jar`;
  const installerPath = path.join(gameDir, "forge-installers", `forge-${full}-installer.jar`);

  onProgress && onProgress({ stage: "forge", message: `Forge ${forgeVersion} installer indiriliyor...` });
  await downloadFile(installerUrl, installerPath, null);

  const versionsDir = path.join(gameDir, "versions");
  const beforeDirs = fs.existsSync(versionsDir) ? fs.readdirSync(versionsDir) : [];

  onProgress && onProgress({ stage: "forge", message: "Forge kuruluyor (resmi installer çalıştırılıyor, biraz sürebilir)..." });
  const result = spawnSync(javaPath, ["-jar", installerPath, "--installClient", gameDir], {
    cwd: gameDir,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20
  });

  if (result.error) {
    throw new Error(`Forge installer çalıştırılamadı: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const out = (result.stderr || result.stdout || "").slice(-800);
    throw new Error(`Forge installer hata ile sonlandı (kod ${result.status}): ${out}`);
  }

  const afterDirs = fs.existsSync(versionsDir) ? fs.readdirSync(versionsDir) : [];
  let forgeDirName = afterDirs.find(d => !beforeDirs.includes(d) && d.toLowerCase().includes("forge"));
  if (!forgeDirName) forgeDirName = afterDirs.find(d => d.includes(full));
  if (!forgeDirName) {
    throw new Error("Forge kurulumu tamamlandı görünüyor ama sürüm klasörü bulunamadı. Installer çıktısını kontrol et.");
  }
  return forgeDirName;
}

module.exports = { installForge, getLatestForgeVersion };
