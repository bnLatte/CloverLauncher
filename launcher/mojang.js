const fs = require("fs");
const path = require("path");
const os = require("os");
const AdmZip = require("adm-zip");
const { fetchJson, downloadFile } = require("./net");

const MANIFEST_URL = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

function currentOsName() {
  const p = process.platform;
  if (p === "win32") return "windows";
  if (p === "darwin") return "osx";
  return "linux";
}

function rulesAllow(rules) {
  if (!rules) return true;
  let allowed = false;
  for (const rule of rules) {
    const osMatch = !rule.os || (
      (!rule.os.name || rule.os.name === currentOsName()) &&
      (!rule.os.arch || rule.os.arch === process.arch)
    );
    if (osMatch) allowed = rule.action === "allow";
  }
  return allowed;
}

async function getVersionManifest() {
  return fetchJson(MANIFEST_URL);
}

async function getVersionInfo(versionId, gameDir) {
  const manifest = await getVersionManifest();
  const entry = manifest.versions.find((v) => v.id === versionId);
  if (!entry) throw new Error(`Sürüm bulunamadı: ${versionId}`);

  const versionJsonPath = path.join(gameDir, "versions", versionId, `${versionId}.json`);
  await downloadFile(entry.url, versionJsonPath, entry.sha1);
  return JSON.parse(fs.readFileSync(versionJsonPath, "utf8"));
}

/**
 * İstemci .jar, kütüphaneler ve native (.dll/.so/.dylib) dosyalarını indirir.
 * Geriye { classpathEntries, nativesDir, clientJarPath } döner.
 */
async function downloadClientAndLibraries(versionInfo, gameDir, onProgress) {
  const versionId = versionInfo.id;
  const clientJarPath = path.join(gameDir, "versions", versionId, `${versionId}.jar`);
  const clientDl = versionInfo.downloads.client;

  onProgress && onProgress({ stage: "client", detail: versionId });
  await downloadFile(clientDl.url, clientJarPath, clientDl.sha1);

  const nativesDir = path.join(gameDir, "versions", versionId, "natives");
  fs.mkdirSync(nativesDir, { recursive: true });

  const classpathEntries = [clientJarPath];
  const libs = versionInfo.libraries || [];
  const osName = currentOsName();

  for (let i = 0; i < libs.length; i++) {
    const lib = libs[i];
    if (!rulesAllow(lib.rules)) continue;

    onProgress && onProgress({ stage: "library", detail: lib.name, index: i, total: libs.length });

    if (lib.downloads && lib.downloads.artifact) {
      const art = lib.downloads.artifact;
      const dest = path.join(gameDir, "libraries", art.path);
      if (art.url) {
        await downloadFile(art.url, dest, art.sha1);
        classpathEntries.push(dest);
      } else if (fs.existsSync(dest)) {
        // Forge installer bazı kütüphaneleri url vermeden zaten yerel olarak koyar
        classpathEntries.push(dest);
      }
    } else if (!lib.downloads && lib.name) {
      // Maven tarzı (name + url) kütüphane - Fabric/Forge'da sık görülür
      const mavenPath = mavenPathFromName(lib.name);
      const dest = path.join(gameDir, "libraries", mavenPath);
      if (lib.url) {
        try {
          await downloadFile(lib.url.replace(/\/?$/, "/") + mavenPath, dest, lib.sha1 || null);
          classpathEntries.push(dest);
        } catch (e) {
          console.warn("Kütüphane indirilemedi:", lib.name, e.message);
        }
      } else if (fs.existsSync(dest)) {
        classpathEntries.push(dest);
      }
    }

    if (!lib.downloads) continue;

    // Native (platforma özel .dll/.so/.dylib) sınıflandırıcı
    let classifierKey = null;
    if (lib.natives && lib.natives[osName]) {
      classifierKey = lib.natives[osName].replace("${arch}", process.arch === "x64" ? "64" : "32");
    }
    if (classifierKey && lib.downloads.classifiers && lib.downloads.classifiers[classifierKey]) {
      const nat = lib.downloads.classifiers[classifierKey];
      const natDest = path.join(gameDir, "libraries", nat.path);
      await downloadFile(nat.url, natDest, nat.sha1);
      try {
        const zip = new AdmZip(natDest);
        zip.getEntries().forEach((entry) => {
          if (!entry.isDirectory && !entry.entryName.startsWith("META-INF")) {
            zip.extractEntryTo(entry, nativesDir, false, true);
          }
        });
      } catch (e) {
        console.warn("Native çıkarılamadı:", nat.path, e.message);
      }
    }
  }

  return { classpathEntries, nativesDir, clientJarPath };
}

/**
 * Ses/dil/varlık dosyalarını indirir (assets/objects/xx/hash).
 * skipAssets true ise bu adım atlanır (daha hızlı ama sessiz/eksik doku olabilir).
 */
async function downloadAssets(versionInfo, gameDir, onProgress, skipAssets) {
  const assetIndexMeta = versionInfo.assetIndex;
  const indexPath = path.join(gameDir, "assets", "indexes", `${assetIndexMeta.id}.json`);
  await downloadFile(assetIndexMeta.url, indexPath, assetIndexMeta.sha1);
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));

  if (skipAssets) {
    return { assetsRoot: path.join(gameDir, "assets"), assetIndexId: assetIndexMeta.id };
  }

  const objects = Object.entries(index.objects || {});
  for (let i = 0; i < objects.length; i++) {
    const [, obj] = objects[i];
    const hash = obj.hash;
    const sub = hash.slice(0, 2);
    const dest = path.join(gameDir, "assets", "objects", sub, hash);
    const url = `https://resources.download.minecraft.net/${sub}/${hash}`;
    if (i % 25 === 0 && onProgress) {
      onProgress({ stage: "assets", index: i, total: objects.length });
    }
    await downloadFile(url, dest, hash);
  }

  return { assetsRoot: path.join(gameDir, "assets"), assetIndexId: assetIndexMeta.id };
}

function mavenPathFromName(name) {
  const [group, artifact, version, classifier] = name.split(":");
  const groupPath = group.replace(/\./g, "/");
  const file = classifier
    ? `${artifact}-${version}-${classifier}.jar`
    : `${artifact}-${version}.jar`;
  return `${groupPath}/${artifact}/${version}/${file}`;
}

/**
 * Fabric/Forge gibi loader'ların kendi kütüphane listelerini indirir.
 * Girdi formatı ya vanilla tarzı {downloads:{artifact:{...}}} ya da
 * maven tarzı {name:"grp:art:ver", url:"https://maven..."} olabilir.
 * "url" yoksa (Forge installer'ın zaten yerel olarak koyduğu durumlar),
 * dosyanın halihazırda libraries/ altında bulunduğu varsayılır.
 */
async function downloadGenericLibraries(libs, gameDir, onProgress) {
  const entries = [];
  for (let i = 0; i < libs.length; i++) {
    const lib = libs[i];
    if (lib.rules && !rulesAllow(lib.rules)) continue;

    let dest, url, sha1;
    if (lib.downloads && lib.downloads.artifact) {
      dest = path.join(gameDir, "libraries", lib.downloads.artifact.path);
      url = lib.downloads.artifact.url;
      sha1 = lib.downloads.artifact.sha1;
    } else if (lib.name) {
      const mavenPath = mavenPathFromName(lib.name);
      dest = path.join(gameDir, "libraries", mavenPath);
      url = lib.url ? lib.url.replace(/\/?$/, "/") + mavenPath : null;
      sha1 = lib.sha1 || null;
    } else {
      continue;
    }

    onProgress && onProgress({ stage: "loader-library", detail: lib.name, index: i, total: libs.length });

    if (url) {
      try {
        await downloadFile(url, dest, sha1);
      } catch (e) {
        console.warn("Kütüphane indirilemedi:", lib.name || url, e.message);
        continue;
      }
    } else if (!fs.existsSync(dest)) {
      console.warn("Kütüphane yerel olarak bulunamadı ve indirme adresi yok:", lib.name);
      continue;
    }
    entries.push(dest);
  }
  return entries;
}

function loadLocalVersionJson(versionId, gameDir) {
  const p = path.join(gameDir, "versions", versionId, `${versionId}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function mergeArguments(parentArgs, childArgs) {
  if (!parentArgs && !childArgs) return undefined;
  return {
    game: [...(parentArgs && parentArgs.game || []), ...(childArgs && childArgs.game || [])],
    jvm: [...(parentArgs && parentArgs.jvm || []), ...(childArgs && childArgs.jvm || [])]
  };
}

/**
 * "inheritsFrom" alanı olan bir sürüm JSON'unu (Fabric/Forge profilleri gibi)
 * temel (vanilla) sürümüyle birleştirir. Sonuç, normal bir vanilla sürümü
 * gibi launch.js tarafından kullanılabilir.
 */
async function resolveInheritedVersion(childJson, gameDir, onProgress) {
  if (!childJson.inheritsFrom) return childJson;

  onProgress && onProgress({ stage: "manifest", message: `Temel sürüm alınıyor: ${childJson.inheritsFrom}` });
  const parent = await getVersionInfo(childJson.inheritsFrom, gameDir);

  return {
    ...parent,
    id: childJson.id || parent.id,
    mainClass: childJson.mainClass || parent.mainClass,
    libraries: [...(parent.libraries || []), ...(childJson.libraries || [])],
    arguments: childJson.arguments || parent.arguments
      ? mergeArguments(parent.arguments, childJson.arguments)
      : undefined,
    minecraftArguments: childJson.minecraftArguments || parent.minecraftArguments,
    javaVersion: childJson.javaVersion || parent.javaVersion,
    // downloads / assetIndex / assets her zaman vanilla ebeveynden gelir
    downloads: parent.downloads,
    assetIndex: parent.assetIndex,
    assets: parent.assets
  };
}

module.exports = {
  getVersionManifest,
  getVersionInfo,
  downloadClientAndLibraries,
  downloadAssets,
  downloadGenericLibraries,
  mavenPathFromName,
  loadLocalVersionJson,
  resolveInheritedVersion,
  mergeArguments,
  currentOsName
};
