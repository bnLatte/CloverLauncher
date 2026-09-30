const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cloverlauncher", {
  isElectron: true,

  // pencere kontrolleri
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),

  // dış bağlantılar (yalnızca izin verilen sabit adresler)
  openDiscord: () => ipcRenderer.send("open-external", "https://discord.gg/M2m8nyYWAE"),

  // gerçek Minecraft (offline mod) işlemleri
  listVersions: () => ipcRenderer.invoke("vl:list-versions"),
  downloadAndLaunch: (opts) => ipcRenderer.invoke("vl:download-and-launch", opts),
  stop: () => ipcRenderer.invoke("vl:stop"),

  onProgress: (cb) => ipcRenderer.on("vl:progress", (_e, data) => cb(data)),
  onLog: (cb) => ipcRenderer.on("vl:log", (_e, line) => cb(line)),
  onExit: (cb) => ipcRenderer.on("vl:exit", (_e, code) => cb(code)),

  // Modrinth: mod / texture pack / shader arama ve kurulum (Fabric & Forge)
  modrinthSearch: (opts) => ipcRenderer.invoke("vl:modrinth-search", opts),
  modrinthInstall: (opts) => ipcRenderer.invoke("vl:modrinth-install", opts),
  profileListItems: (opts) => ipcRenderer.invoke("vl:profile-list-items", opts),
  profileRemoveItem: (opts) => ipcRenderer.invoke("vl:profile-remove-item", opts)
});
