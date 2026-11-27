## 1.1.0 - 2026-11-27
- Oyun guncellendi.

# Değişiklik Günlüğü

## 1.1.0 — 2026-11-27
- Online galeri yeniden düzenlendi: katalogdaki 1288 modelin tamamı görünür (önceden yalnızca 200), her ana kategori altında alt kategoriler (Savaş uçakları, Fırkateynler, Panelvan vb.) var.
- Yanlış eşleşen ve bozuk galeri fotoğrafları kaldırıldı; her araç kendi türüne uygun görselle açılır, internet varsa modelin kendi fotoğrafı bulunup kalıcı önbelleğe alınır.
- Genel sohbet: yönetici girişinde mesajlar kırmızı ve YÖNETİCİ etiketiyle yazılır; bozuk sohbet simgesi düzeltildi.
- Her hesap (Google, X, misafir, yönetici) ayrı şirket kaydı kullanır; yönetici parası/yetkisi misafire veya diğer hesaplara geçmez.
- Gerçek Google ve X girişi (OAuth 2.0 + PKCE) eklendi; kurulum için OAUTH_KURULUM.txt.
- Tarayıcıdaki `admin/admin` yedek girişi kaldırıldı; yönetici girişi yalnız Windows uygulamasında.
- Performans: kayıt gecikmeli yazılır, galeri/sohbet/ayarlar ekranları her oyun gününde yeniden çizilmez, galeri araması önbellekli ve sınırlı eşzamanlı.

## 1.0.1 — 2026-11-27
- Otomatik güncelleme adresi düzeltildi (GitHub sahibi: SIMULATOR-PATRONU).
- Yönetici girişi artık düz metin değil, scrypt özetiyle doğrulanır; giriş ekranındaki varsayılan şifre ipucu kaldırıldı.

## 1.0.0 — 2026-11-26
- Windows x64 masaüstü proje paketi hazırlandı.
- Electron güvenli pencere ve preload köprüsü eklendi.
- Oyun kayıtları Windows DPAPI destekli safeStorage ile şifrelenir.
- Son sağlam kayıt için ayrı yedek dosyası eklendi.
- Yönetici girişi ana süreçte doğrulanır; başarısız denemelere geçici kilit uygulanır.
- GitHub Releases tabanlı otomatik güncelleme altyapısı eklendi.
- Sürüm etiketleme ve yayınlama betiği eklendi.
