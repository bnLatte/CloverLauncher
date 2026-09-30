const path = require("path");
const { spawn } = require("child_process");
const { offlineUUID } = require("./uuid");
const { currentOsName } = require("./mojang");

function rulesAllow(rules) {
  if (!rules) return true;
  let allowed = false;
  for (const rule of rules) {
    const osOk = !rule.os || (
      (!rule.os.name || rule.os.name === currentOsName()) &&
      (!rule.os.arch || rule.os.arch === process.arch)
    );
    const hasFeatures = !!rule.features;
    if (osOk && !hasFeatures) allowed = rule.action === "allow";
    else if (hasFeatures) allowed = false; // demo/quick-play gibi opsiyonel özellikler desteklenmiyor
  }
  return allowed;
}

function substitute(str, map) {
  return str.replace(/\$\{([^}]+)\}/g, (_, key) => (key in map ? map[key] : `\${${key}}`));
}

function processArgList(list, map) {
  const out = [];
  if (!list) return out;
  for (const item of list) {
    if (typeof item === "string") {
      out.push(substitute(item, map));
    } else if (item && typeof item === "object") {
      if (!rulesAllow(item.rules)) continue;
      const values = Array.isArray(item.value) ? item.value : [item.value];
      values.forEach((v) => out.push(substitute(v, map)));
    }
  }
  return out;
}

/**
 * Java komutunu ve argümanlarını oluşturur (indirme YAPMAZ, sadece çalıştırır).
 * Offline mod: gerçek Microsoft/Mojang hesap doğrulaması yapılmaz, sadece kullanıcı
 * adı kullanılır. Bu yalnızca online-mode=false ayarlı kendi sunucun / tek oyuncu
 * dünyaların için çalışır; resmi çok oyunculu sunuculara bağlanamaz.
 */
function buildLaunchCommand({ versionInfo, gameDir, classpathEntries, nativesDir, assetsRoot, assetIndexId, username, ramMB, javaPath }) {
  const uuid = offlineUUID(username);
  const classpath = classpathEntries.join(path.delimiter);

  const map = {
    auth_player_name: username,
    version_name: versionInfo.id,
    game_directory: gameDir,
    assets_root: assetsRoot,
    game_assets: assetsRoot,
    assets_index_name: assetIndexId,
    auth_uuid: uuid,
    auth_access_token: "0",
    auth_session: "0",
    user_type: "legacy",
    user_properties: "{}",
    version_type: versionInfo.type || "release",
    natives_directory: nativesDir,
    launcher_name: "CloverLauncher",
    launcher_version: "1.0.0",
    classpath
  };

  let jvmArgs;
  let gameArgs;

  if (versionInfo.arguments) {
    jvmArgs = processArgList(versionInfo.arguments.jvm, map);
    gameArgs = processArgList(versionInfo.arguments.game, map);
  } else {
    // Eski sürümler (< 1.13): tek parça "minecraftArguments" string'i
    jvmArgs = [`-Djava.library.path=${nativesDir}`, "-cp", classpath];
    gameArgs = (versionInfo.minecraftArguments || "")
      .split(" ")
      .filter(Boolean)
      .map((tok) => substitute(tok, map));
  }

  const mainClass = versionInfo.mainClass;
  const jvmMemFlags = [`-Xmx${ramMB}M`, `-Xms${Math.min(ramMB, 1024)}M`];

  // Güvenlik ağı: bir loader (Fabric/Forge) profili birleştirilirken -cp veya
  // java.library.path token'ları bir şekilde eksik kalırsa, java komutu
  // classpath OLMADAN çalışır ve "ClassNotFoundException" verir. Bunu
  // sessizce yaşamamak için burada garanti altına alıyoruz.
  const jvmArgsStr = jvmArgs.join(" ");
  if (!jvmArgsStr.includes("-cp") && !jvmArgsStr.includes("-classpath")) {
    jvmArgs.push("-cp", classpath);
  }
  if (!jvmArgsStr.includes("java.library.path")) {
    jvmArgs.unshift(`-Djava.library.path=${nativesDir}`);
  }

  const fullArgs = [...jvmMemFlags, ...jvmArgs, mainClass, ...gameArgs];

  return { command: javaPath || "java", args: fullArgs, cwd: gameDir };
}

function launchOffline(opts, onLog, onExit) {
  const { command, args, cwd } = buildLaunchCommand(opts);
  const child = spawn(command, args, { cwd });

  child.stdout.on("data", (d) => onLog && onLog(d.toString()));
  child.stderr.on("data", (d) => onLog && onLog(d.toString()));
  child.on("error", (err) => onLog && onLog(`[CloverLauncher] Java başlatılamadı: ${err.message}\n`));
  child.on("close", (code) => onExit && onExit(code));

  return child;
}

module.exports = { buildLaunchCommand, launchOffline };
