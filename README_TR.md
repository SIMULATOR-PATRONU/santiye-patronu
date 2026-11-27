# Şantiye Patronu — Windows ve Güncelleme Paketi

**Sürüm:** 1.0.0  
**Platform:** Windows 10/11 x64  
**Oyun:** `app/game.html`

## İlk Windows kurulumunu oluşturma

1. Node.js 24 LTS ve Git for Windows kur.
2. ZIP'i bir klasöre çıkar.
3. İlk dağıtımdan önce `main.cjs` içindeki geçici yönetici girişini değiştir.
4. GitHub'da `santiye-patronu` adında boş bir repository oluştur.
5. `SETUP_GITHUB.bat` dosyasını bir kez çalıştırıp GitHub kullanıcı adını gir.
6. `build-windows.bat` dosyasını çalıştır. Kurulum `.exe` dosyası `dist` klasöründe oluşur.

## Bundan sonra oyun nasıl güncellenir?

1. Yeni HTML sürümünü `app/game.html` dosyasının yerine koy.
2. Gerekirse masaüstü kodlarını da aynı proje klasöründe güncelle.
3. `publish-release.bat` dosyasını çalıştır.
4. Yeni sürümü gir: `1.0.1`, `1.0.2`, `1.1.0` gibi. Eski sürüm numarasını tekrar kullanma.
5. Tek satır değişiklik notu yaz.
6. GitHub **Actions** bölümünde Windows Release işini kontrol et.
7. İşlem tamamlanınca yeni kurulum GitHub **Releases** bölümünde yayınlanır. Oyuncunun kurulu uygulaması açılışta güncellemeyi kontrol eder.

`SETUP_GITHUB.bat` yalnızca ilk kurulum içindir. Sonraki güncellemelerde `publish-release.bat` kullanılır.

## Kayıt güvenliği

Oyun kayıtları Windows kullanıcı profilinde `Electron safeStorage` üzerinden Windows DPAPI ile şifrelenir. Önceki sağlam kayıt ayrı dosyada saklanır ve uygulama güncellemeleri kullanıcı verilerini silmez. Yine de büyük sürümlerden önce oyundaki yedek seçeneğiyle ayrıca yedek almak önerilir.

## Güncelleme dosyaları

- `app/game.html` — oyun
- `main.cjs` — Electron ana süreç, DPAPI kayıtları, admin doğrulaması, updater
- `preload.cjs` — sınırlı ve güvenli renderer köprüsü
- `package.json` — sürüm ve Windows derleme ayarları
- `.github/workflows/release.yml` — etiket gönderildiğinde Windows kurulumunu üretir
- `SETUP_GITHUB.bat` — tek seferlik repository bağlantısı
- `publish-release.bat` — her yeni sürümü yayınlar
- `build-windows.bat` — Windows kurulum EXE'sini yerel olarak oluşturur

**Dağıtım notu:** GitHub Releases otomatik güncellemesinin tüm oyuncular tarafından kimlik doğrulaması olmadan alınabilmesi için standart kurulumda public repository gerekir. Public kaynak deposuna geçmeden önce varsayılan yönetici girişini değiştir. Private repository için ayrıca kimlik doğrulamalı güncelleme sunucusu gerekir.
