CloverLauncher - Gerçek Offline Minecraft Launcher (Electron)
===========================================================

BU GÜNCELLEMEDE NELER DEĞİŞTİ
------------------------------
0. KRİTİK HATA DÜZELTİLDİ: "Could not find or load main class
   net.fabricmc.loader.impl.launch.knot.KnotClient"
   Sebep: Fabric profilini vanilla sürümüyle birleştirirken "arguments"
   alanı TAMAMEN üzerine yazılıyordu; bu, vanilla'nın jvm argümanlarındaki
   hayati "-cp ${classpath}" ve "-Djava.library.path=..." token'larını
   siliyordu, yani java hiç classpath olmadan çalışıyordu. Artık
   launcher/mojang.js -> mergeArguments() ile vanilla + Fabric argümanları
   doğru şekilde BİRLEŞTİRİLİYOR. Ayrıca launcher/launch.js'e, bu token'lar
   her ne sebeple olursa olsun eksik kalırsa otomatik ekleyen bir güvenlik
   ağı eklendi — bu sınıf hata bir daha sessizce oluşmaz.

0.1 KRİTİK HATA DÜZELTİLDİ: "duplicate ASM classes found on classpath"
   Sebep: Vanilla'nın kendi kütüphane listesi VE Fabric/Forge'un kendi
   kütüphane listesi bazen aynı bağımlılığın (ör. "asm") FARKLI
   sürümlerini içerir; ikisi de classpath'e eklenince Fabric/Forge bunu
   çakışma sanıp hata veriyordu. main.js'e artifact adına göre
   tekilleştirme (dedupeLibrariesByArtifact) eklendi: aynı kütüphanenin
   birden fazla sürümü varsa, listede SONRA gelen (loader'ın istediği,
   yani doğru olan) sürüm tutulur, öncekiler classpath'ten çıkarılır.

1. OTOMATİK JAVA KURULUMU (UnsupportedClassVersionError düzeltildi)
   Her Minecraft sürümünün ihtiyaç duyduğu Java çalışma zamanı artık
   OTOMATİK indirilir (launcher/java.js). Mojang'ın resmi, herkese açık
   Java runtime indeksini kullanır — sistemindeki Java'yı hiç kullanmaz,
   bu yüzden "class file version 65.0 ... only recognizes up to 61.0"
   gibi sürüm uyuşmazlığı hataları artık oluşmaz. Her sürüm kendi
   izole Java'sını ~/.cloverlauncher/runtime altında saklar.

2. SKIN SİSTEMİ DÜZELTİLDİ
   Önceden yüklenen skin dosyası ham haliyle (tüm sprite sheet) gösteriliyordu,
   bu da bozuk görünüyordu. Artık script.js, 64x64/64x32'lik skin dosyasından
   gerçek bir "kafa" görüntüsü (yüz + şapka katmanı) canvas ile kesip
   oluşturuyor ve hem Skin sayfasında hem de üstteki profil kutusunda
   (kullanıcı adının solunda) bunu gösteriyor. Geçersiz/PNG olmayan dosyalar
   artık anlamlı bir hata mesajı veriyor.

3. VANİLLA PROFİLLER ARTIK GERÇEKTEN VANİLLA
   Vanilla seçilen profillerde Mod / Texture Pack / Shader sekmeleri artık
   TAMAMEN GİZLİ — bunun yerine "Bu bir Vanilla profildir" notu gösteriliyor.
   Mod/texture pack/shader eklemek istiyorsan profili Fabric veya Forge ile
   oluşturman gerekiyor.

4. FABRIC — TAM OTOMATİK (gerçek)
   Fabric profili seçildiğinde launcher/fabric.js, Fabric'in resmi Meta
   API'sinden (meta.fabricmc.net) o Minecraft sürümü için en güncel stabil
   Fabric Loader profilini indirir, vanilla sürümüyle birleştirir ve
   doğrudan başlatır. Ekstra kurulum adımı gerekmez.

5. FORGE — resmi installer üzerinden (deneysel)
   Forge seçildiğinde launcher/forge.js, Forge'un KENDİ resmi installer
   .jar dosyasını (files.minecraftforge.net / maven.minecraftforge.net)
   indirir ve `java -jar installer.jar --installClient <dizin>` ile
   headless (arayüzsüz) kurar. Bytecode yamalama mantığını biz yeniden
   YAZMIYORUZ — bunu tamamen Forge'un kendi resmi aracı yapıyor.
   NOT: Bazı Forge sürümlerinde installer'ın headless modu hata verebilir;
   bu durumda hata mesajı ekranda gösterilir. Bu kısım Fabric kadar
   olgunlaşmış değildir, yeni Minecraft sürümlerinde en iyi çalışır.

6. MOD / TEXTURE PACK / SHADER ARTIK MODRINTH'TEN
   Fabric/Forge profillerinde "Mod", "Texture Pack" ve "Shader" sekmeleri
   artık dosya sürükle-bırak yerine gerçek Modrinth arama kutusu içeriyor
   (launcher/modrinth.js, api.modrinth.com). Arama sonuçlarında "Ekle"ye
   basınca dosya gerçekten indirilip profilin kendi klasörüne
   (~/.cloverlauncher/profiles/<id>/mods|resourcepacks|shaderpacks) kopyalanır.
   Mod arama, profilin loader'ına (fabric/forge) göre filtrelenir.
   "Modpack" sekmesi şimdilik yer tutucu (yakında).

7. HER PROFİLİN KENDİ İZOLE KLASÖRÜ VAR
   ~/.cloverlauncher/profiles/<profileId>/  -> mods, resourcepacks, shaderpacks,
   saves, options.txt burada tutulur (gerçek launcher'lar gibi instance
   izolasyonu). Sürüm/kütüphane/asset/Java önbelleği ise paylaşılan
   ~/.cloverlauncher altında tek sefer indirilir, tüm profiller arasında ortak
   kullanılır (disk alanından tasarruf).

8. DISCORD BUTONU
   Sol alttaki Discord ikonu artık tıklanabilir ve
   https://discord.gg/M2m8nyYWAE adresini varsayılan tarayıcıda açar
   (yalnızca bu sabit adrese izin verilir, güvenlik için).

KURULUM
-------
1. VSCode'da klasörü aç (File > Open Folder > cloverlauncher)
2. Terminal: npm install
3. Terminal: npm start
   (İlk sürüm indirmesi/Java kurulumu birkaç dakika sürebilir, ilerleme
   ve `java` konsol çıktısı ekrandaki panelde canlı gösterilir.)

DOSYA YAPISI (launcher/ klasörü)
---------------------------------
launcher/net.js      -> genel indirme + SHA1 doğrulama yardımcıları
launcher/mojang.js    -> sürüm listesi, istemci/kütüphane/asset indirme,
                         inheritsFrom birleştirme (Fabric/Forge için)
launcher/java.js      -> sürüme özel Java runtime'ın otomatik indirilmesi
launcher/fabric.js    -> Fabric Meta API entegrasyonu
launcher/forge.js     -> Forge resmi installer'ını headless çalıştırma
launcher/modrinth.js  -> Modrinth arama + indirme
launcher/uuid.js      -> offline-mode UUID üretimi
launcher/launch.js    -> version json'dan gerçek `java` komutunu kurup
                         process'i başlatma

OFFLINE MOD HAKKINDA (ÖNEMLİ)
-------------------------------
Bu launcher, Minecraft'ın kendi resmi olarak desteklediği offline modu
kullanır: server.properties içinde online-mode=false olan sunucularda ve
tek oyunculu dünyalarda Microsoft/Mojang hesap doğrulaması yapılmadan,
sadece bir kullanıcı adıyla oynanabilir. Bu:
  - SADECE kendi sunucun / singleplayer için çalışır.
  - Resmi Mojang çok oyunculu sunucularına BAĞLANAMAZ (onlar hesap
    doğrulamasını zorunlu tutar; bunu atlatan bir mekanizma YOKTUR).
  - Tüm .jar/kütüphane/Java dosyaları Mojang'ın herkese açık resmi
    CDN'inden indirilir; DRM kırma / crack-patch içermez.

BİLİNEN SINIRLAMALAR
----------------------
- Quilt ve NeoForge için otomatik kurulum henüz yok (UI'da seçilebilir
  ama "Oynat" tıklanınca bunu belirten bir uyarı çıkar).
- Modpack (.mrpack) içe aktarma henüz yok.
- Gerçek klasör seçici (Ayarlar > Oyun Dizini / Java Yolu) kozmetiktir,
  şu an sabit ~/.cloverlauncher konumu kullanılıyor.
- Forge desteği Fabric kadar test edilmemiştir; bazı sürümlerde
  installer'ın headless modu başarısız olabilir.
