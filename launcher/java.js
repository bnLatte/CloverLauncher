const fs = require("fs");
const path = require("path");
const { fetchJson, downloadFile } = require("./net");

// Mojang'ın resmi, herkese açık Java çalışma zamanı indeksi.
// Resmi Minecraft Launcher da tam olarak bu adresi kullanır.
const RUNTIME_INDEX_URL = "https://piston-meta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json";

function platformKey() {
  const plat = process.platform;
  const arch = process.arch;
  if (plat === "win32") {
    if (arch === "arm64") return "windows-arm64";
    if (arch === "x64") return "windows-x64";
    return "windows-x86";
  }
  if (plat === "darwin") {
    return arch === "arm64" ? "mac-os-arm64" : "mac-os";
  }
  return arch === "x64" ? "linux" : "linux-i386";
}

function javaBinaryName() {
  return process.platform === "win32" ? "java.exe" : "java";
}

function findJavaBinary(dir) {
  const binName = javaBinaryName();
  if (!fs.existsSync(dir)) return null;
  const direct = path.join(dir, "bin", binName);
  if (fs.existsSync(direct)) return direct;

  // macOS gibi iç içe klasör yapıları için (jre.bundle/Contents/Home/bin/java) recursive ara
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let items;
    try { items = fs.readdirSync(cur, { withFileTypes: true }); } catch (e) { continue; }
    for (const it of items) {
      const full = path.join(cur, it.name);
      if (it.isDirectory()) stack.push(full);
      else if (it.name === binName && full.includes(`${path.sep}bin${path.sep}`)) {
        return full;
      }
    }
  }
  return null;
}

/**
 * Verilen sürümün ihtiyaç duyduğu Java bileşenini (ör. "java-runtime-gamma")
 * gerekirse indirir ve çalıştırılabilir java yolunu döner.
 * Zaten indirilmişse tekrar indirmez.
 */
async function ensureJavaRuntime(component, gameDir, onProgress) {
  const comp = component || "jre-legacy";
  const runtimeDir = path.join(gameDir, "runtime", comp, platformKey());
  const markerFile = path.join(runtimeDir, ".installed");

  if (fs.existsSync(markerFile)) {
    const found = findJavaBinary(runtimeDir);
    if (found) return found;
  }

  onProgress && onProgress({ stage: "java", message: `Java (${comp}) bilgisi alınıyor...` });
  const allJson = await fetchJson(RUNTIME_INDEX_URL);
  const pk = platformKey();
  const entries = allJson[pk] && allJson[pk][comp];
  if (!entries || !entries.length) {
    throw new Error(`Bu platform (${pk}) için Java bileşeni bulunamadı: ${comp}. Lütfen sistemine uygun bir Java kur ve Ayarlar > Java Yolu'ndan seç.`);
  }

  const manifestUrl = entries[0].manifest.url;
  const filesManifest = await fetchJson(manifestUrl);
  const fileEntries = Object.entries(filesManifest.files || {}).filter(([, info]) => info.type === "file" && info.downloads && info.downloads.raw);

  let done = 0;
  for (const [relPath, info] of fileEntries) {
    const dest = path.join(runtimeDir, relPath);
    await downloadFile(info.downloads.raw.url, dest, info.downloads.raw.sha1);
    if (info.executable && process.platform !== "win32") {
      try { fs.chmodSync(dest, 0o755); } catch (e) { /* yoksay */ }
    }
    done++;
    if (done % 15 === 0 && onProgress) {
      onProgress({ stage: "java", message: `Java indiriliyor (${done}/${fileEntries.length})`, index: done, total: fileEntries.length });
    }
  }

  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(markerFile, "ok");

  const found = findJavaBinary(runtimeDir);
  if (!found) throw new Error("Java indirildi ama çalıştırılabilir dosya bulunamadı.");
  return found;
}

module.exports = { ensureJavaRuntime, platformKey };
