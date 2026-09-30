const path = require("path");
const { fetchJson, downloadFile } = require("./net");

const API = "https://api.modrinth.com/v2";

function projectTypeForKind(kind) {
  if (kind === "mod") return "mod";
  if (kind === "texturepack") return "resourcepack";
  if (kind === "shader") return "shader";
  throw new Error("Bilinmeyen içerik türü: " + kind);
}

async function search(kind, query, loader, gameVersion) {
  const projectType = projectTypeForKind(kind);
  const facets = [[`project_type:${projectType}`]];
  if (loader && projectType === "mod") facets.push([`categories:${loader.toLowerCase()}`]);
  if (gameVersion) facets.push([`versions:${gameVersion}`]);

  const url = `${API}/search?query=${encodeURIComponent(query || "")}&facets=${encodeURIComponent(JSON.stringify(facets))}&limit=24`;
  const data = await fetchJson(url);
  return (data.hits || []).map(h => ({
    projectId: h.project_id,
    title: h.title,
    author: h.author,
    description: h.description,
    downloads: h.downloads,
    iconUrl: h.icon_url,
    slug: h.slug
  }));
}

async function getBestVersionFile(projectId, kind, loader, gameVersion) {
  const projectType = projectTypeForKind(kind);
  const qs = [];
  if (gameVersion) qs.push(`game_versions=${encodeURIComponent(JSON.stringify([gameVersion]))}`);
  if (loader && projectType === "mod") qs.push(`loaders=${encodeURIComponent(JSON.stringify([loader.toLowerCase()]))}`);

  let url = `${API}/project/${projectId}/version`;
  if (qs.length) url += "?" + qs.join("&");

  const versions = await fetchJson(url);
  if (!versions || !versions.length) {
    throw new Error("Bu Minecraft sürümü / loader için uygun bir dosya bulunamadı.");
  }
  const best = versions[0];
  const file = best.files.find(f => f.primary) || best.files[0];
  if (!file) throw new Error("İndirilebilir dosya bulunamadı.");
  return {
    url: file.url,
    filename: file.filename,
    sha1: file.hashes && file.hashes.sha1,
    size: file.size,
    versionNumber: best.version_number,
    // Sadece "required" (zorunlu) bağımlılıkları otomatik kuruyoruz.
    // "optional"/"incompatible" olanlara dokunmuyoruz.
    dependencies: (best.dependencies || [])
      .filter(d => d.dependency_type === "required" && d.project_id)
  };
}

async function installFromModrinth(projectId, kind, loader, gameVersion, destDir, _seen) {
  const seen = _seen || new Set();
  if (seen.has(projectId)) return { installed: [] };
  seen.add(projectId);

  const file = await getBestVersionFile(projectId, kind, loader, gameVersion);
  const dest = path.join(destDir, file.filename);
  await downloadFile(file.url, dest, file.sha1);

  const installed = [{ filename: file.filename, size: file.size, versionNumber: file.versionNumber, projectId }];

  // Sadece mod türü için: gerekli (required) bağımlı modları da otomatik indir.
  // Bir bağımlılık bu sürüm/loader için bulunamazsa, tüm kurulumu
  // başarısız yapmadan sessizce atla (ör. bazı bağımlılıklar client-only olmayabilir).
  if (kind === "mod" && file.dependencies && file.dependencies.length) {
    for (const dep of file.dependencies) {
      try {
        const depResult = await installFromModrinth(dep.project_id, kind, loader, gameVersion, destDir, seen);
        installed.push(...depResult.installed);
      } catch (e) {
        // bağımlılık atlandı
      }
    }
  }

  return { installed };
}

module.exports = { search, installFromModrinth };
