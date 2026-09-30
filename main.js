/*
 * CloverLauncher (c) 2026 bnLatte. Tüm hakları saklıdır.
 * Bu dosyanın kopyalanması, değiştirilerek yeniden dağıtılması veya
 * başka bir projede kullanılması izin ve LICENSE dosyasına tabidir.
 */

const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { autoUpdater } = require("electron-updater");

const mojang = require("./launcher/mojang");
const { launchOffline } = require("./launcher/launch");
const { ensureJavaRuntime } = require("./launcher/java");
const { getFabricProfile } = require("./launcher/fabric");
const { installForge } = require("./launcher/forge");
const modrinth = require("./launcher/modrinth");

/* ================= CACHE FIX ================= */

const cacheFolder = path.join(
  os.homedir(),
  "AppData",
  "Local",
  "VLauncherCache"
);

try {
  fs.mkdirSync(cacheFolder, {
    recursive: true
  });
} catch (e) {
  console.log(
    "Cache klasörü oluşturulamadı:",
    e.message
  );
}

app.commandLine.appendSwitch(
  "disk-cache-dir",
  cacheFolder
);

app.commandLine.appendSwitch(
  "disable-gpu-shader-disk-cache"
);

/* ================= DISCORD RICH PRESENCE ================= */

let rpc = null;
let discordReady = false;

let currentVersion = null;
let currentProfileName = null;
let minecraftStartTime = null;

const DISCORD_CLIENT_ID =
  "1527244234778870010";

/*
 * CloverLauncher Discord RPC sistemi.
 */
try {

  const RPC = require("discord-rpc");

  RPC.register(
    DISCORD_CLIENT_ID
  );

  rpc = new RPC.Client({
    transport: "ipc"
  });

  rpc.on("ready", () => {

    discordReady = true;

    console.log(
      "========================================"
    );

    console.log(
      "[Discord] RPC hazır."
    );

    console.log(
      "[Discord] Client ID:",
      DISCORD_CLIENT_ID
    );

    console.log(
      "========================================"
    );

    updateDiscord();

  });

  rpc.on("disconnected", () => {

    discordReady = false;

    console.log(
      "[Discord] RPC bağlantısı kesildi."
    );

  });

  rpc.login({
    clientId:
      DISCORD_CLIENT_ID
  })
    .then(() => {

      console.log(
        "[Discord] RPC login başarılı."
      );

    })
    .catch((err) => {

      console.log(
        "[Discord] Discord'a bağlanılamadı:",
        err.message
      );

    });

} catch (e) {

  console.log(
    "[Discord] discord-rpc modülü yüklenemedi:",
    e.message
  );

}

/* ================= DISCORD AKTİVİTESİ ================= */

function updateDiscord() {

  if (!rpc || !discordReady) {

    console.log(
      "[Discord] RPC hazır değil."
    );

    return;

  }

  const playingMinecraft =
    currentVersion !== null;

  const activity = {

    type: 0,

    details:
      playingMinecraft
        ? `Minecraft ${currentVersion}`
        : "CloverLauncher kullanıyor",

    state:
      playingMinecraft
        ? "Minecraft Oynuyor"
        : "Ana menüde",

    largeImageKey:
      "cloverlauncher",

    largeImageText:
      "CloverLauncher",

    instance: false

  };

  if (
    playingMinecraft &&
    minecraftStartTime
  ) {

    activity.startTimestamp =
      minecraftStartTime;

  }

  console.log(
    "========================================"
  );

  console.log(
    "[Discord] Aktivite gönderiliyor:"
  );

  console.log(
    activity
  );

  console.log(
    "========================================"
  );

  rpc.setActivity(
    activity
  )
    .then(() => {

      console.log(
        "[Discord] Rich Presence başarıyla güncellendi."
      );

    })
    .catch((err) => {

      console.error(
        "[Discord] Rich Presence hatası:",
        err.message
      );

    });

}

/* ================= DISCORD TEMİZLE ================= */

function clearDiscord() {

  if (!rpc || !discordReady) {

    return;

  }

  minecraftStartTime = null;

  rpc.clearActivity()
    .then(() => {

      console.log(
        "[Discord] Rich Presence temizlendi."
      );

    })
    .catch((err) => {

      console.log(
        "[Discord] Rich Presence temizlenemedi:",
        err.message
      );

    });

}

/* ================= ANA PENCERE ================= */

let mainWindow;
let currentChild = null;

function createWindow() {

  mainWindow =
    new BrowserWindow({

      width: 1280,

      height: 720,

      minWidth: 1000,

      minHeight: 620,

      frame: false,

      backgroundColor:
        "#0d0f16",

      icon: path.join(
        __dirname,
        "assets",
        "logo.png"
      ),

      webPreferences: {

        preload:
          path.join(
            __dirname,
            "preload.js"
          ),

        contextIsolation:
          true,

        nodeIntegration:
          false

      }

    });

  mainWindow.loadFile(
    "index.html"
  );

}

/* ================= OTOMATİK GÜNCELLEME ================= */

function setupAutoUpdater() {

  /*
   * Geliştirme modunda updater çalıştırma.
   */
  if (!app.isPackaged) {

    console.log(
      "[Updater] Geliştirme modunda çalışıyor. Güncelleme kontrolü atlandı."
    );

    return;

  }

  /*
   * Güncellemeleri otomatik indir.
   */
  autoUpdater.autoDownload = true;

  /*
   * Kullanıcı uygulamayı kapatırsa,
   * indirilen güncelleme bir sonraki açılışta kurulabilir.
   */
  autoUpdater.autoInstallOnAppQuit = true;

  /*
   * Güncelleme bulundu.
   */
  autoUpdater.on(
    "update-available",
    (info) => {

      console.log(
        "========================================"
      );

      console.log(
        "[Updater] Güncelleme bulundu."
      );

      console.log(
        "[Updater] Mevcut sürüm:",
        app.getVersion()
      );

      console.log(
        "[Updater] Yeni sürüm:",
        info.version
      );

      console.log(
        "========================================"
      );

    }
  );

  /*
   * Güncel.
   */
  autoUpdater.on(
    "update-not-available",
    () => {

      console.log(
        "[Updater] CloverLauncher güncel."
      );

    }
  );

  /*
   * İndirme ilerlemesi.
   */
  autoUpdater.on(
    "download-progress",
    (progress) => {

      console.log(
        `[Updater] Güncelleme indiriliyor: ${Math.round(progress.percent)}%`
      );

    }
  );

  /*
   * Güncelleme hatası.
   */
  autoUpdater.on(
    "error",
    (err) => {

      console.log(
        "[Updater] Güncelleme hatası:",
        err.message
      );

    }
  );

  /*
   * Güncelleme indirildi.
   */
  autoUpdater.on(
    "update-downloaded",
    (info) => {

      console.log(
        "========================================"
      );

      console.log(
        "[Updater] Güncelleme indirildi."
      );

      console.log(
        "[Updater] Sürüm:",
        info.version
      );

      console.log(
        "========================================"
      );

      if (!mainWindow) {

        return;

      }

      dialog.showMessageBox(
        mainWindow,
        {

          type:
            "info",

          title:
            "CloverLauncher Güncellemesi",

          message:
            `CloverLauncher ${info.version} hazır.`,

          detail:
            "Güncelleme indirildi. CloverLauncher şimdi yeniden başlatılarak güncellensin mi?",

          buttons: [

            "Şimdi Güncelle",

            "Daha Sonra"

          ],

          defaultId:
            0,

          cancelId:
            1

        }
      )
        .then(
          (result) => {

            if (
              result.response === 0
            ) {

              autoUpdater.quitAndInstall(
                false,
                true
              );

            }

          }
        );

    });

  /*
   * Launcher'ın tamamen açılmasını bekle.
   */
  setTimeout(
    () => {

      console.log(
        "[Updater] Güncelleme kontrol ediliyor..."
      );

      autoUpdater
        .checkForUpdates()
        .then(
          () => {

            console.log(
              "[Updater] Güncelleme kontrolü tamamlandı."
            );

          }
        )
        .catch(
          (err) => {

            console.log(
              "[Updater] Güncelleme kontrolü yapılamadı:",
              err.message
            );

          }
        );

    },
    5000
  );

}

/* ================= ELECTRON READY ================= */

app.whenReady().then(() => {

  if (
    process.platform === "win32"
  ) {

    /*
     * Eski VLauncher ile aynı AppUserModelId.
     * Bu nedenle Windows uygulama kimliği korunur.
     */
    app.setAppUserModelId(
      "com.vlauncher.app"
    );

  }

  createWindow();

  /*
   * Otomatik güncelleme sistemi.
   */
  setupAutoUpdater();

  app.on(
    "activate",
    () => {

      if (
        BrowserWindow
          .getAllWindows()
          .length === 0
      ) {

        createWindow();

      }

    }
  );

});

/* ================= UYGULAMA KAPANMASI ================= */

app.on(
  "window-all-closed",
  () => {

    if (
      process.platform !== "darwin"
    ) {

      app.quit();

    }

  }
);

/* ================= PENCERE KONTROLLERİ ================= */

ipcMain.on(
  "window:minimize",
  () => {

    if (mainWindow) {

      mainWindow.minimize();

    }

  }
);

ipcMain.on(
  "window:maximize",
  () => {

    if (!mainWindow) {

      return;

    }

    if (
      mainWindow.isMaximized()
    ) {

      mainWindow.unmaximize();

    } else {

      mainWindow.maximize();

    }

  }
);

ipcMain.on(
  "window:close",
  () => {

    if (mainWindow) {

      mainWindow.close();

    }

  }
);

/* ================= DIŞ LİNKLER ================= */

ipcMain.on(
  "open-external",
  (event, url) => {

    const allowed = [
      "https://discord.gg/M2m8nyYWAE"
    ];

    if (
      allowed.includes(url)
    ) {

      shell.openExternal(
        url
      );

    }

  }
);

/* ================= DİZİN YARDIMCILARI ================= */

function sharedGameDir() {

  return path.join(
    os.homedir(),
    ".vlauncher"
  );

}

function profileDir(
  profileId
) {

  return path.join(
    sharedGameDir(),
    "profiles",
    profileId
  );

}

function profileContentDir(
  profileId,
  kind
) {

  const folder =
    kind === "mod"
      ? "mods"
      : kind === "texturepack"
        ? "resourcepacks"
        : "shaderpacks";

  return path.join(
    profileDir(profileId),
    folder
  );

}

/* ================= CLASS PATH DEDUPE ================= */

function dedupeLibrariesByArtifact(
  entries,
  librariesRoot
) {

  const indexByArtifact =
    new Map();

  const result = [];

  for (
    const entryPath of entries
  ) {

    const rel =
      path.relative(
        librariesRoot,
        entryPath
      );

    const parts =
      rel.split(
        path.sep
      );

    if (
      rel.startsWith("..") ||
      parts.length < 3
    ) {

      result.push(
        entryPath
      );

      continue;

    }

    const artifact =
      parts[
        parts.length - 3
      ];

    const filename =
      parts[
        parts.length - 1
      ];

    if (
      /-natives-/i.test(
        filename
      )
    ) {

      result.push(
        entryPath
      );

      continue;

    }

    if (
      indexByArtifact.has(
        artifact
      )
    ) {

      result[
        indexByArtifact.get(
          artifact
        )
      ] =
        entryPath;

    } else {

      indexByArtifact.set(
        artifact,
        result.length
      );

      result.push(
        entryPath
      );

    }

  }

  return result;

}

/* ================= SÜRÜM LİSTESİ ================= */

ipcMain.handle(
  "vl:list-versions",
  async () => {

    const manifest =
      await mojang
        .getVersionManifest();

    return manifest
      .versions
      .filter(
        v =>
          v.type === "release"
      )
      .slice(
        0,
        40
      );

  }
);

/* ================= MODRINTH SEARCH ================= */

ipcMain.handle(
  "vl:modrinth-search",
  async (
    event,
    {
      kind,
      query,
      loader,
      gameVersion
    }
  ) => {

    try {

      const results =
        await modrinth.search(
          kind,
          query,
          loader,
          gameVersion
        );

      return {
        ok: true,
        results
      };

    } catch (e) {

      return {
        ok: false,
        error:
          e.message
      };

    }

  }
);

/* ================= MODRINTH INSTALL ================= */

ipcMain.handle(
  "vl:modrinth-install",
  async (
    event,
    {
      profileId,
      kind,
      projectId,
      loader,
      gameVersion
    }
  ) => {

    try {

      const dest =
        profileContentDir(
          profileId,
          kind
        );

      fs.mkdirSync(
        dest,
        {
          recursive: true
        }
      );

      const result =
        await modrinth
          .installFromModrinth(
            projectId,
            kind,
            loader,
            gameVersion,
            dest
          );

      return {
        ok: true,
        installed:
          result.installed
      };

    } catch (e) {

      return {
        ok: false,
        error:
          e.message
      };

    }

  }
);

/* ================= PROFILE ITEMS ================= */

ipcMain.handle(
  "vl:profile-list-items",
  async (
    event,
    {
      profileId,
      kind
    }
  ) => {

    const dest =
      profileContentDir(
        profileId,
        kind
      );

    if (
      !fs.existsSync(
        dest
      )
    ) {

      return [];

    }

    return fs
      .readdirSync(
        dest
      )
      .filter(
        name =>
          !name.startsWith(".")
      )
      .map(
        name => {

          const stat =
            fs.statSync(
              path.join(
                dest,
                name
              )
            );

          return {

            name,

            size:
              stat.size

          };

        }
      );

  }
);

/* ================= PROFILE ITEM REMOVE ================= */

ipcMain.handle(
  "vl:profile-remove-item",
  async (
    event,
    {
      profileId,
      kind,
      filename
    }
  ) => {

    const dest =
      profileContentDir(
        profileId,
        kind
      );

    const target =
      path.join(
        dest,
        filename
      );

    if (
      fs.existsSync(
        target
      )
    ) {

      fs.unlinkSync(
        target
      );

    }

    return {
      ok: true
    };

  }
);

/* ================= GERÇEK İNDİRME + BAŞLATMA ================= */

ipcMain.handle(
  "vl:download-and-launch",
  async (
    event,
    {
      versionId,
      loader,
      username,
      ramMB,
      skipAssets,
      profileId,
      profileName
    }
  ) => {

    const shared =
      sharedGameDir();

    fs.mkdirSync(
      shared,
      {
        recursive: true
      }
    );

    const pDir =
      profileDir(
        profileId ||
        "default"
      );

    fs.mkdirSync(
      pDir,
      {
        recursive: true
      }
    );

    [
      "mods",
      "resourcepacks",
      "shaderpacks"
    ].forEach(
      f => {

        fs.mkdirSync(
          path.join(
            pDir,
            f
          ),
          {
            recursive: true
          }
        );

      }
    );

    const send =
      (
        channel,
        payload
      ) => {

        event.sender.send(
          channel,
          payload
        );

      };

    currentVersion =
      versionId;

    currentProfileName =
      profileName || null;

    minecraftStartTime =
      null;

    console.log(
      "[Minecraft] Başlatılıyor:",
      versionId
    );

    try {

      send(
        "vl:progress",
        {
          stage:
            "manifest",

          message:
            "Sürüm bilgisi alınıyor..."
        }
      );

      let versionInfo =
        await mojang
          .getVersionInfo(
            versionId,
            shared
          );

      /* ================= JAVA ================= */

      const javaComponent =
        versionInfo.javaVersion
          ? versionInfo
              .javaVersion
              .component
          : "jre-legacy";

      send(
        "vl:progress",
        {
          stage:
            "java",

          message:
            `Java (${javaComponent}) kontrol ediliyor...`
        }
      );

      const javaPath =
        await ensureJavaRuntime(
          javaComponent,
          shared,
          (p) =>
            send(
              "vl:progress",
              p
            )
        );

      let extraLibraries = [];

      /* ================= FABRIC ================= */

      if (
        loader === "Fabric"
      ) {

        const fabricProfile =
          await getFabricProfile(
            versionId,
            (p) =>
              send(
                "vl:progress",
                p
              )
          );

        versionInfo = {

          ...versionInfo,

          id:
            fabricProfile.id ||
            versionInfo.id,

          mainClass:
            fabricProfile.mainClass,

          arguments:
            mojang.mergeArguments(
              versionInfo.arguments,
              fabricProfile.arguments
            )

        };

        extraLibraries =
          fabricProfile
            .libraries ||
          [];

      }

      /* ================= FORGE ================= */

      else if (
        loader === "Forge"
      ) {

        const forgeVersionId =
          await installForge(
            versionId,
            shared,
            javaPath,
            (p) =>
              send(
                "vl:progress",
                p
              )
          );

        let forgeJson =
          mojang
            .loadLocalVersionJson(
              forgeVersionId,
              shared
            );

        if (!forgeJson) {

          throw new Error(
            "Forge sürüm dosyası okunamadı."
          );

        }

        versionInfo =
          await mojang
            .resolveInheritedVersion(
              forgeJson,
              shared,
              (p) =>
                send(
                  "vl:progress",
                  p
                )
            );

        extraLibraries = [];

      }

      /* ================= CLIENT + LIBRARIES ================= */

      const {
        classpathEntries,
        nativesDir
      } =
        await mojang
          .downloadClientAndLibraries(
            versionInfo,
            shared,
            (p) =>
              send(
                "vl:progress",
                {

                  stage:
                    p.stage,

                  message:
                    `İndiriliyor: ${p.detail || ""}`,

                  index:
                    p.index,

                  total:
                    p.total

                }
              )
          );

      /* ================= LOADER LIBRARIES ================= */

      if (
        extraLibraries.length
      ) {

        const extraEntries =
          await mojang
            .downloadGenericLibraries(
              extraLibraries,
              shared,
              (p) =>
                send(
                  "vl:progress",
                  {

                    stage:
                      "loader-library",

                    message:
                      `Loader kütüphanesi: ${p.detail || ""}`,

                    index:
                      p.index,

                    total:
                      p.total

                  }
                )
            );

        classpathEntries.push(
          ...extraEntries
        );

      }

      /* ================= CLASS PATH DEDUPE ================= */

      const dedupedClasspath =
        dedupeLibrariesByArtifact(
          classpathEntries,
          path.join(
            shared,
            "libraries"
          )
        );

      /* ================= ASSETS ================= */

      const {
        assetsRoot,
        assetIndexId
      } =
        await mojang
          .downloadAssets(
            versionInfo,
            shared,
            (p) =>
              send(
                "vl:progress",
                {

                  stage:
                    "assets",

                  message:
                    `Varlıklar indiriliyor (${p.index}/${p.total})`,

                  index:
                    p.index,

                  total:
                    p.total

                }
              ),
            !!skipAssets
          );

      /* ================= LAUNCH ================= */

      send(
        "vl:progress",
        {
          stage:
            "launching",

          message:
            "Java başlatılıyor..."
        }
      );

      minecraftStartTime =
        Date.now();

      currentChild =
        launchOffline(

          {

            versionInfo,

            gameDir:
              pDir,

            classpathEntries:
              dedupedClasspath,

            nativesDir,

            assetsRoot,

            assetIndexId,

            username:
              username ||
              "Steve",

            ramMB:
              ramMB ||
              4096,

            javaPath

          },

          (logLine) =>
            send(
              "vl:log",
              logLine
            ),

          (code) => {

            send(
              "vl:exit",
              code
            );

            currentChild =
              null;

            currentVersion =
              null;

            currentProfileName =
              null;

            minecraftStartTime =
              null;

            clearDiscord();

            if (mainWindow) {

              mainWindow.show();

              mainWindow.focus();

            }

          }

        );

      console.log(
        "[Minecraft] Process başlatıldı."
      );

      updateDiscord();

      setTimeout(
        () => {

          if (
            mainWindow &&
            currentChild
          ) {

            mainWindow.hide();

          }

        },
        4000
      );

      return {
        ok: true
      };

    } catch (err) {

      currentVersion =
        null;

      currentProfileName =
        null;

      minecraftStartTime =
        null;

      clearDiscord();

      send(
        "vl:progress",
        {
          stage:
            "error",

          message:
            err.message
        }
      );

      return {

        ok: false,

        error:
          err.message

      };

    }

  }
);

/* ================= MINECRAFT DURDUR ================= */

ipcMain.handle(
  "vl:stop",
  async () => {

    if (
      currentChild
    ) {

      currentChild.kill();

      currentChild =
        null;

      currentVersion =
        null;

      currentProfileName =
        null;

      minecraftStartTime =
        null;

      clearDiscord();

      if (
        mainWindow
      ) {

        mainWindow.show();

        mainWindow.focus();

      }

      return {
        ok: true
      };

    }

    return {
      ok: false
    };

  }
);

/* ================= UYGULAMA KAPANIRKEN DISCORD ================= */

app.on(
  "before-quit",
  () => {

    try {

      if (
        rpc &&
        discordReady
      ) {

        rpc.clearActivity()
          .catch(
            () => {}
          );

      }

    } catch (_) {}

  }
);