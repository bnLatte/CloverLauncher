const { fetchJson } = require("./net");

const META = "https://meta.fabricmc.net/v2";

/**
 * Verilen Minecraft sürümü için en güncel (stabil) Fabric Loader'ı bulur
 * ve resmi Fabric Meta API'sinden hazır "launcher profili" JSON'unu döner.
 * Bu JSON, vanilla version.json'u genişletir (mainClass + ek kütüphaneler).
 */
async function getFabricProfile(mcVersion, onProgress) {
  onProgress && onProgress({ stage: "fabric", message: "Fabric loader sürümleri kontrol ediliyor..." });

  const loaders = await fetchJson(`${META}/versions/loader/${mcVersion}`);
  if (!loaders || !loaders.length) {
    throw new Error(`Bu Minecraft sürümü için Fabric bulunamadı: ${mcVersion}`);
  }
  const stable = loaders.find(l => l.loader.stable) || loaders[0];
  const loaderVersion = stable.loader.version;

  onProgress && onProgress({ stage: "fabric", message: `Fabric Loader ${loaderVersion} profili alınıyor...` });
  const profile = await fetchJson(`${META}/versions/loader/${mcVersion}/${loaderVersion}/profile/json`);
  return profile; // { id, inheritsFrom, mainClass, libraries, arguments/jvm... }
}

module.exports = { getFabricProfile };
