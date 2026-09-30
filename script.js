/* =========================================================
   CloverLauncher — Copyright (c) 2026 bnLatte. Tüm hakları saklıdır.
   Kopyalanması / yeniden dağıtılması LICENSE dosyasına tabidir.
   ---------------------------------------------------------
   CloverLauncher - front-end demo logic
   Tüm veriler localStorage üzerinde saklanır (gerçek bir
   Minecraft başlatma / indirme işlemi YAPMAZ, bu bir arayüz
   şablonudur — gerçek launcher mantığını buraya bağlaman gerekir).
   ========================================================= */

const STORE_KEY = "cloverlauncher_state_v1";

function loadState(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){}

  return {
    username: "Steve",
    profiles: [],
    activeProfileId: null,
    settings: {
      ram: 4,
      gameDir: "C:\\Users\\CloverLauncher\\.cloverlauncher",
      javaPath: "Otomatik algıla",
      resolution: "1600x900",
      closeOnLaunch: false
    }
  };
}

let state = loadState();

function save(){
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function uid(){
  return Math.random().toString(36).slice(2,9);
}

/* ---------------- NAVIGATION ---------------- */

const navItems = document.querySelectorAll(".nav-item");
const pages = document.querySelectorAll(".page");

function goToPage(name){
  navItems.forEach(b =>
    b.classList.toggle("active", b.dataset.page === name)
  );

  pages.forEach(p =>
    p.classList.toggle("active", p.id === "page-" + name)
  );

  if(name === "surumler"){
    showSurumlerList();
  }
}

navItems.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    goToPage(btn.dataset.page);
  });
});

/* ---------------- WINDOW CONTROLS ---------------- */

const inElectron =
  typeof window.cloverlauncher !== "undefined";

const btnMin = document.getElementById("btnMin");
const btnMax = document.getElementById("btnMax");
const btnClose = document.getElementById("btnClose");

if(btnMin){
  btnMin.addEventListener("click", ()=>{
    if(inElectron){
      window.cloverlauncher.minimize();
    }else{
      console.log(
        "Küçült tıklandı (tarayıcıda çalışıyor)"
      );
    }
  });
}

if(btnMax){
  btnMax.addEventListener("click", ()=>{
    if(inElectron){
      window.cloverlauncher.maximize();
    }else{
      document.querySelector(".window")
        ?.classList.toggle("maximized");
    }
  });
}

if(btnClose){
  btnClose.addEventListener("click", ()=>{
    if(inElectron){
      window.cloverlauncher.close();
    }else{
      console.log(
        "Kapat tıklandı (tarayıcıda çalışıyor)"
      );
    }
  });
}

/* ---------------- PROFILE SELECT DROPDOWN ---------------- */

function renderProfileSelectors(){

  const selectors = [
    {
      sel:"#profileSelect",
      drop:"#profileDropdown",
      name:"#profileUserLabel",
      ver:"#profileVersionLabel"
    },
    {
      sel:"#profileSelect2",
      drop:"#profileDropdown2",
      name:"#profileUserLabel2",
      ver:"#profileVersionLabel2"
    }
  ];

  selectors.forEach(cfg=>{

    const nameEl = document.querySelector(cfg.name);
    const verEl = document.querySelector(cfg.ver);
    const dropEl = document.querySelector(cfg.drop);

    /*
     * Haberler'deki profil alanı kaldırılmış olabilir.
     * Eleman yoksa bu selectorü atla.
     */
    if(!nameEl || !verEl || !dropEl){
      return;
    }

    nameEl.textContent =
      state.username || "Kullanıcı adı";

    const active =
      state.profiles.find(
        p => p.id === state.activeProfileId
      );

    verEl.textContent =
      active
        ? `${active.version} (${active.loader})`
        : "Profil seçilmedi";

    dropEl.innerHTML = "";

    if(state.profiles.length === 0){

      const empty =
        document.createElement("div");

      empty.className =
        "profile-dropdown-empty";

      empty.textContent =
        "Henüz profil yok. Sürümler sayfasından oluştur.";

      dropEl.appendChild(empty);

    }else{

      state.profiles.forEach(p=>{

        const item =
          document.createElement("div");

        item.className =
          "profile-dropdown-item";

        item.innerHTML = `
          <span class="pdi-name">
            ${escapeHtml(p.name)}
          </span>
          <span class="pdi-version">
            ${p.version} (${p.loader})
          </span>
        `;

        item.addEventListener("click", e=>{

          e.stopPropagation();

          state.activeProfileId = p.id;

          save();

          renderProfileSelectors();
          renderOynaInfo();

          dropEl.classList.remove("open");
        });

        dropEl.appendChild(item);
      });
    }
  });
}

/* Profile selector 1 */

const profileSelect =
  document.getElementById("profileSelect");

const profileDropdown =
  document.getElementById("profileDropdown");

if(profileSelect && profileDropdown){

  profileSelect.addEventListener("click", ()=>{
    profileDropdown.classList.toggle("open");
  });
}

/* Profile selector 2 */

const profileSelect2 =
  document.getElementById("profileSelect2");

const profileDropdown2 =
  document.getElementById("profileDropdown2");

if(profileSelect2 && profileDropdown2){

  profileSelect2.addEventListener("click", ()=>{
    profileDropdown2.classList.toggle("open");
  });
}

/* Dışarı tıklayınca dropdown kapat */

document.addEventListener("click", e=>{

  if(
    profileDropdown &&
    !e.target.closest("#profileSelect")
  ){
    profileDropdown.classList.remove("open");
  }

  if(
    profileDropdown2 &&
    !e.target.closest("#profileSelect2")
  ){
    profileDropdown2.classList.remove("open");
  }

});

function escapeHtml(str){
  return String(str).replace(
    /[&<>"']/g,
    c => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#39;"
    }[c])
  );
}

/* ---------------- BAŞLAT / OYNA ---------------- */

const launchOverlay =
  document.getElementById("launchOverlay");

const launchProgressFill =
  document.getElementById("launchProgressFill");

const launchStatus =
  document.getElementById("launchStatus");

const launchLog =
  document.getElementById("launchLog");

const launchTitle =
  document.getElementById("launchTitle");

function showLaunchOverlay(title){

  if(!launchOverlay) return;

  if(launchTitle){
    launchTitle.textContent = title;
  }

  if(launchProgressFill){
    launchProgressFill.style.width = "0%";
  }

  if(launchStatus){
    launchStatus.textContent = "Başlatılıyor...";
  }

  if(launchLog){
    launchLog.textContent = "";
  }

  launchOverlay.classList.remove("hidden");
}

const btnCloseLaunch =
  document.getElementById("btnCloseLaunch");

if(btnCloseLaunch){

  btnCloseLaunch.addEventListener("click", ()=>{
    launchOverlay?.classList.add("hidden");
  });
}

const btnStopLaunch =
  document.getElementById("btnStopLaunch");

if(btnStopLaunch){

  btnStopLaunch.addEventListener(
    "click",
    async ()=>{
      if(inElectron){
        await window.cloverlauncher.stop();
      }

      if(launchStatus){
        launchStatus.textContent =
          "Durduruldu.";
      }
    }
  );
}

if(inElectron){

  window.cloverlauncher.onProgress(p=>{

    if(!launchStatus) return;

    if(p.stage === "error"){
      launchStatus.textContent =
        "Hata: " + p.message;
      return;
    }

    launchStatus.textContent =
      p.message || p.stage;

    if(p.total && launchProgressFill){

      const pct =
        Math.min(
          100,
          Math.round((p.index / p.total) * 100)
        );

      launchProgressFill.style.width =
        pct + "%";

    }else if(
      p.stage === "client" &&
      launchProgressFill
    ){

      launchProgressFill.style.width =
        "15%";

    }else if(
      p.stage === "launching" &&
      launchProgressFill
    ){

      launchProgressFill.style.width =
        "100%";
    }
  });

  window.cloverlauncher.onLog(line=>{

    if(!launchLog) return;

    launchLog.textContent += line;
    launchLog.scrollTop =
      launchLog.scrollHeight;
  });

  window.cloverlauncher.onExit(code=>{

    if(!launchStatus) return;

    launchStatus.textContent =
      `Minecraft kapandı (çıkış kodu: ${code})`;
  });
}

async function launchGame(){

  const active =
    state.profiles.find(
      p => p.id === state.activeProfileId
    );

  if(!active){

    alert(
      "Önce Sürümler sayfasından bir profil oluştur ve seç."
    );

    return;
  }

  if(!inElectron){

    alert(
      `${active.name} (${active.version} - ${active.loader}) başlatılıyor...\n\n` +
      `(Tarayıcı önizlemesinde gerçek oyun başlatılamaz. ` +
      `"npm start" ile Electron uygulamasını çalıştırırsan ` +
      `gerçek indirme + offline başlatma devreye girer.)`
    );

    return;
  }

  const supportedLoaders =
    ["Vanilla", "Fabric", "Forge"];

  if(!supportedLoaders.includes(active.loader)){

    alert(
      `"${active.loader}" yükleyicisi için gerçek otomatik kurulum henüz eklenmedi.\n` +
      `Şu an desteklenenler: Vanilla, Fabric, Forge.`
    );

    return;
  }

  showLaunchOverlay(
    `${active.name} — ${active.version} (${active.loader}) hazırlanıyor`
  );

  const result =
    await window.cloverlauncher.downloadAndLaunch({

      versionId: active.version,
      loader: active.loader,
      profileId: active.id,
      profileName: active.name,
      username: state.username || "Steve",
      ramMB: (state.settings.ram || 4) * 1024,
      skipAssets: false

    });

  if(!result.ok && launchStatus){
    launchStatus.textContent =
      "Hata: " + result.error;
  }
}

/* Haberler BAŞLAT butonu kaldırılmış olabilir */

const btnBaslatHome =
  document.getElementById("btnBaslatHome");

if(btnBaslatHome){
  btnBaslatHome.addEventListener(
    "click",
    launchGame
  );
}

/* Oyna butonu */

const btnBaslatOyna =
  document.getElementById("btnBaslatOyna");

if(btnBaslatOyna){
  btnBaslatOyna.addEventListener(
    "click",
    launchGame
  );
}

function renderOynaInfo(){

  const active =
    state.profiles.find(
      p => p.id === state.activeProfileId
    );

  const profileInfo =
    document.getElementById("oynaProfileInfo");

  const recentInfo =
    document.getElementById("oynaRecentInfo");

  if(profileInfo){

    profileInfo.textContent = active
      ? `${active.name} — ${active.version} (${active.loader}) seçili.`
      : "Henüz bir profil seçmedin. Sürümler sayfasından bir profil oluştur.";
  }

  if(recentInfo){

    recentInfo.textContent =
      state.profiles.length
        ? state.profiles.map(p=>p.name).join(", ")
        : "Henüz oynanmış bir profil yok.";
  }
}

/* ================= AYARLAR ================= */

const setRam =
  document.getElementById("setRam");

const ramValue =
  document.getElementById("ramValue");

function initSettingsForm(){

  const username =
    document.getElementById("setUsername");

  const gameDir =
    document.getElementById("setGameDir");

  const javaPath =
    document.getElementById("setJavaPath");

  const res =
    document.getElementById("setRes");

  const closeOnLaunch =
    document.getElementById("setCloseOnLaunch");

  if(username){
    username.value =
      state.username;
  }

  if(setRam){
    setRam.value =
      state.settings.ram;
  }

  if(ramValue){
    ramValue.textContent =
      state.settings.ram + " GB";
  }

  if(gameDir){
    gameDir.value =
      state.settings.gameDir;
  }

  if(javaPath){
    javaPath.value =
      state.settings.javaPath;
  }

  if(res){
    res.value =
      state.settings.resolution;
  }

  if(closeOnLaunch){
    closeOnLaunch.checked =
      state.settings.closeOnLaunch;
  }
}

if(setRam){

  setRam.addEventListener(
    "input",
    ()=>{
      if(ramValue){
        ramValue.textContent =
          setRam.value + " GB";
      }
    }
  );
}

const btnSaveSettings =
  document.getElementById("btnSaveSettings");

if(btnSaveSettings){

  btnSaveSettings.addEventListener(
    "click",
    ()=>{

      const username =
        document.getElementById("setUsername");

      const resolution =
        document.getElementById("setRes");

      const closeOnLaunch =
        document.getElementById("setCloseOnLaunch");

      state.username =
        username?.value.trim() || "Steve";

      state.settings.ram =
        Number(setRam?.value || 4);

      state.settings.resolution =
        resolution?.value || "1600x900";

      state.settings.closeOnLaunch =
        closeOnLaunch?.checked || false;

      save();

      renderProfileSelectors();

      btnSaveSettings.textContent =
        "Kaydedildi ✓";

      setTimeout(()=>{
        btnSaveSettings.textContent =
          "Ayarları Kaydet";
      }, 1400);
    }
  );
}

const btnBrowseDir =
  document.getElementById("btnBrowseDir");

if(btnBrowseDir){

  btnBrowseDir.addEventListener(
    "click",
    ()=>{
      alert(
        "Bu şablonda gerçek dosya sistemi seçici yok. Electron'da dialog.showOpenDialog kullanılmalı."
      );
    }
  );
}

const btnBrowseJava =
  document.getElementById("btnBrowseJava");

if(btnBrowseJava){

  btnBrowseJava.addEventListener(
    "click",
    ()=>{
      alert(
        "Bu şablonda gerçek dosya sistemi seçici yok. Electron'da dialog.showOpenDialog kullanılmalı."
      );
    }
  );
}

/* ================= SÜRÜMLER ================= */

const listView =
  document.getElementById("surumlerListView");

const createView =
  document.getElementById("surumlerCreateView");

const detailView =
  document.getElementById("surumlerDetailView");

function showSurumlerList(){

  if(!listView || !createView || !detailView){
    return;
  }

  listView.classList.remove("hidden");
  createView.classList.add("hidden");
  detailView.classList.add("hidden");

  renderProfileGrid();
}

let versionsLoaded = false;

async function loadRealVersionList(){

  if(
    !inElectron ||
    versionsLoaded
  ){
    return;
  }

  try{

    const versions =
      await window.cloverlauncher.listVersions();

    const sel =
      document.getElementById(
        "newProfileVersion"
      );

    if(!sel) return;

    sel.innerHTML = "";

    versions.forEach(v=>{

      const opt =
        document.createElement("option");

      opt.value = v.id;
      opt.textContent = v.id;

      sel.appendChild(opt);
    });

    versionsLoaded = true;

  }catch(e){

    console.warn(
      "Sürüm listesi alınamadı:",
      e.message
    );
  }
}

function showSurumlerCreate(){

  if(!listView || !createView || !detailView){
    return;
  }

  listView.classList.add("hidden");
  createView.classList.remove("hidden");
  detailView.classList.add("hidden");

  const name =
    document.getElementById(
      "newProfileName"
    );

  if(name){
    name.value = "";
  }

  document
    .querySelectorAll(
      "#loaderOptions .loader-opt"
    )
    .forEach((b,i)=>
      b.classList.toggle("active", i===0)
    );

  loadRealVersionList();
}

let currentDetailId = null;

function showSurumlerDetail(id){

  if(!listView || !createView || !detailView){
    return;
  }

  currentDetailId = id;

  listView.classList.add("hidden");
  createView.classList.add("hidden");
  detailView.classList.remove("hidden");

  renderDetail();
}

const btnNewProfile =
  document.getElementById("btnNewProfile");

if(btnNewProfile){
  btnNewProfile.addEventListener(
    "click",
    showSurumlerCreate
  );
}

const btnBackFromCreate =
  document.getElementById("btnBackFromCreate");

if(btnBackFromCreate){
  btnBackFromCreate.addEventListener(
    "click",
    showSurumlerList
  );
}

const btnBackFromDetail =
  document.getElementById("btnBackFromDetail");

if(btnBackFromDetail){
  btnBackFromDetail.addEventListener(
    "click",
    showSurumlerList
  );
}

document
  .querySelectorAll(
    "#loaderOptions .loader-opt"
  )
  .forEach(btn=>{

    btn.addEventListener(
      "click",
      ()=>{

        document
          .querySelectorAll(
            "#loaderOptions .loader-opt"
          )
          .forEach(b=>
            b.classList.remove("active")
          );

        btn.classList.add("active");
      }
    );
  });

const btnCreateProfile =
  document.getElementById("btnCreateProfile");

if(btnCreateProfile){

  btnCreateProfile.addEventListener(
    "click",
    ()=>{

      const name =
        document
          .getElementById("newProfileName")
          ?.value.trim();

      if(!name){

        alert(
          "Lütfen bir profil adı gir."
        );

        return;
      }

      const version =
        document.getElementById(
          "newProfileVersion"
        )?.value;

      const loaderBtn =
        document.querySelector(
          "#loaderOptions .loader-opt.active"
        );

      const loader =
        loaderBtn
          ? loaderBtn.dataset.loader
          : "Vanilla";

      const profile = {
        id: uid(),
        name,
        version,
        loader
      };

      state.profiles.push(profile);

      if(!state.activeProfileId){
        state.activeProfileId =
          profile.id;
      }

      save();

      renderProfileSelectors();
      renderOynaInfo();

      showSurumlerDetail(
        profile.id
      );
    }
  );
}

function renderProfileGrid(){

  const grid =
    document.getElementById(
      "profileGrid"
    );

  const empty =
    document.getElementById(
      "profileEmpty"
    );

  if(!grid || !empty){
    return;
  }

  grid.innerHTML = "";

  if(state.profiles.length === 0){

    empty.classList.add("show");
    return;
  }

  empty.classList.remove("show");

  state.profiles.forEach(p=>{

    const card =
      document.createElement("div");

    card.className =
      "profile-card";

    const initials =
      p.name
        .trim()
        .slice(0,2)
        .toUpperCase();

    card.innerHTML = `
      <div class="profile-card-top">

        <div class="profile-card-icon">
          ${escapeHtml(initials)}
        </div>

        <div>

          <div class="profile-card-name">
            ${escapeHtml(p.name)}
          </div>

          <div class="profile-card-meta">
            ${p.version} · ${p.loader}
          </div>

        </div>

      </div>

      <div class="profile-card-actions">

        <button class="pc-play">
          Oynat
        </button>

        <button class="pc-edit">
          Düzenle
        </button>

      </div>
    `;

    card
      .querySelector(".pc-play")
      .addEventListener(
        "click",
        ()=>{
          state.activeProfileId =
            p.id;

          save();

          renderProfileSelectors();
          renderOynaInfo();

          launchGame();
        }
      );

    card
      .querySelector(".pc-edit")
      .addEventListener(
        "click",
        ()=>{
          showSurumlerDetail(p.id);
        }
      );

    grid.appendChild(card);
  });
}

const btnDeleteProfile =
  document.getElementById(
    "btnDeleteProfile"
  );

if(btnDeleteProfile){

  btnDeleteProfile.addEventListener(
    "click",
    ()=>{

      if(
        !confirm(
          "Bu profili silmek istediğine emin misin?"
        )
      ){
        return;
      }

      state.profiles =
        state.profiles.filter(
          p => p.id !== currentDetailId
        );

      if(
        state.activeProfileId ===
        currentDetailId
      ){

        state.activeProfileId =
          state.profiles.length
            ? state.profiles[0].id
            : null;
      }

      save();

      renderProfileSelectors();
      renderOynaInfo();

      showSurumlerList();
    }
  );
}

/* ---- detail tabs ---- */

document
  .querySelectorAll(".detail-tab")
  .forEach(tab=>{

    tab.addEventListener(
      "click",
      ()=>{

        document
          .querySelectorAll(
            ".detail-tab"
          )
          .forEach(t=>
            t.classList.remove("active")
          );

        tab.classList.add("active");

        const key =
          tab.dataset.tab;

        document
          .querySelectorAll(
            ".tab-panel"
          )
          .forEach(p=>{
            p.classList.toggle(
              "active",
              p.dataset.tabPanel === key
            );
          });
      }
    );
  });

async function renderDetail(){

  const profile =
    state.profiles.find(
      p => p.id === currentDetailId
    );

  if(!profile){

    showSurumlerList();
    return;
  }

  const detailProfileName =
    document.getElementById(
      "detailProfileName"
    );

  const detailTabs =
    document.getElementById(
      "detailTabs"
    );

  const vanillaNote =
    document.getElementById(
      "vanillaNote"
    );

  if(detailProfileName){

    detailProfileName.textContent =
      `${profile.name} — ${profile.version} (${profile.loader})`;
  }

  const isVanilla =
    profile.loader === "Vanilla";

  if(detailTabs){
    detailTabs.classList.toggle(
      "hidden",
      isVanilla
    );
  }

  if(vanillaNote){
    vanillaNote.classList.toggle(
      "hidden",
      !isVanilla
    );
  }

  document
    .querySelectorAll(
      "#surumlerDetailView .tab-panel"
    )
    .forEach(p=>{
      p.classList.toggle(
        "hidden",
        isVanilla
      );
    });

  if(!isVanilla){

    [
      "mod",
      "texturepack",
      "shader"
    ].forEach(
      kind =>
        renderInstalledItems(
          profile,
          kind
        )
    );
  }
}

async function renderInstalledItems(
  profile,
  kind
){

  const listEl =
    document.querySelector(
      `.item-list[data-list="${kind}"]`
    );

  if(!listEl) return;

  listEl.innerHTML =
    `<div class="item-list-empty">Yükleniyor...</div>`;

  if(!inElectron){

    listEl.innerHTML =
      `<div class="item-list-empty">Kurulu içerikler yalnızca Electron uygulamasında (npm start) görünür.</div>`;

    return;
  }

  const items =
    await window.cloverlauncher.profileListItems({
      profileId: profile.id,
      kind
    });

  listEl.innerHTML = "";

  if(!items.length){

    listEl.innerHTML =
      `<div class="item-list-empty">Henüz eklenmiş bir öğe yok. Yukarıdan Modrinth'te arayıp "Ekle" ile kurabilirsin.</div>`;

    return;
  }

  items.forEach(item=>{

    const row =
      document.createElement("div");

    row.className =
      "item-row";

    row.innerHTML = `
      <span class="item-name">
        ${escapeHtml(item.name)}
      </span>

      <span class="item-size">
        ${formatSize(item.size)}
      </span>

      <button class="item-remove">
        &#10005;
      </button>
    `;

    row
      .querySelector(".item-remove")
      .addEventListener(
        "click",
        async ()=>{
          await window.cloverlauncher.profileRemoveItem({
            profileId: profile.id,
            kind,
            filename: item.name
          });

          renderInstalledItems(
            profile,
            kind
          );
        }
      );

    listEl.appendChild(row);
  });
}

function formatSize(bytes){

  if(bytes > 1024 * 1024){
    return (
      bytes /
      (1024 * 1024)
    ).toFixed(1) + " MB";
  }

  if(bytes > 1024){
    return (
      bytes / 1024
    ).toFixed(0) + " KB";
  }

  return bytes + " B";
}

/* ---- Modrinth arama ---- */

document
  .querySelectorAll(
    ".modrinth-search-btn"
  )
  .forEach(btn=>{

    btn.addEventListener(
      "click",
      ()=>{
        runModrinthSearch(
          btn.dataset.kind
        );
      }
    );
  });

document
  .querySelectorAll(
    ".modrinth-search-input"
  )
  .forEach(input=>{

    input.addEventListener(
      "keydown",
      e=>{
        if(e.key === "Enter"){
          runModrinthSearch(
            input.dataset.kind
          );
        }
      }
    );
  });

async function runModrinthSearch(kind){

  const profile =
    state.profiles.find(
      p => p.id === currentDetailId
    );

  if(!profile) return;

  const input =
    document.querySelector(
      `.modrinth-search-input[data-kind="${kind}"]`
    );

  const resultsEl =
    document.querySelector(
      `.modrinth-results[data-results="${kind}"]`
    );

  if(!input || !resultsEl){
    return;
  }

  const query =
    input.value.trim();

  if(!inElectron){

    resultsEl.innerHTML =
      `<div class="modrinth-empty">Modrinth araması yalnızca Electron uygulamasında (npm start) çalışır.</div>`;

    return;
  }

  resultsEl.innerHTML =
    `<div class="modrinth-empty">Aranıyor...</div>`;

  const res =
    await window.cloverlauncher.modrinthSearch({
      kind,
      query,
      loader: profile.loader,
      gameVersion: profile.version
    });

  if(!res.ok){

    resultsEl.innerHTML =
      `<div class="modrinth-empty">Hata: ${escapeHtml(res.error)}</div>`;

    return;
  }

  if(!res.results.length){

    resultsEl.innerHTML =
      `<div class="modrinth-empty">Sonuç bulunamadı.</div>`;

    return;
  }

  resultsEl.innerHTML = "";

  res.results.forEach(r=>{

    const card =
      document.createElement("div");

    card.className =
      "modrinth-result-card";

    card.innerHTML = `
      <img
        class="mr-icon"
        src="${r.iconUrl || 'assets/icon_mod.png'}"
        alt=""
      >

      <div class="mr-info">

        <div class="mr-title">
          ${escapeHtml(r.title)}
        </div>

        <div class="mr-author">
          ${escapeHtml(r.author || '')}
        </div>

      </div>

      <button class="mr-add">
        Ekle
      </button>
    `;

    card
      .querySelector(".mr-add")
      .addEventListener(
        "click",
        async e=>{

          const b = e.target;

          b.disabled = true;
          b.textContent =
            "Kuruluyor...";

          const install =
            await window.cloverlauncher.modrinthInstall({
              profileId: profile.id,
              kind,
              projectId: r.projectId,
              loader: profile.loader,
              gameVersion: profile.version
            });

          if(install.ok){

            const extra =
              install.installed.length - 1;

            b.textContent =
              extra > 0
                ? `Kuruldu ✓ (+${extra} bağımlı mod)`
                : "Kuruldu ✓";

            renderInstalledItems(
              profile,
              kind
            );

          }else{

            b.disabled = false;
            b.textContent = "Ekle";

            alert(
              "Kurulamadı: " +
              install.error
            );
          }
        }
      );

    resultsEl.appendChild(card);
  });
}

/* ================= DISCORD ================= */

const btnDiscord =
  document.getElementById("btnDiscord");

if(btnDiscord){

  btnDiscord.addEventListener(
    "click",
    ()=>{
      const url =
        "https://discord.gg/M2m8nyYWAE";

      if(inElectron){
        window.cloverlauncher.openDiscord();
      }else{
        window.open(
          url,
          "_blank",
          "noopener,noreferrer"
        );
      }
    }
  );
}

/* ================= INIT ================= */

function init(){

  if(inElectron){
    document.body.classList.add(
      "app-electron"
    );
  }

  initSettingsForm();
  renderProfileSelectors();
  renderOynaInfo();
  renderProfileGrid();
}

init();