# Trade2Turkey operasyon rehberi

## Yeni günlük kullanım

1. **Aksiyon Merkezi:** geciken, bugün yapılacak, onay bekleyen görevleri ve stok/teslimat uyarılarını gösterir. Kullanıcı daveti, proje erişimi ve yerel JSON yedeği de buradadır.
2. **Tedarik:** SOP adımını açın; sorumlu, farklı bir yönetici onaylayan ve hedef tarih seçin. Not ve gerçek belge bağlantısı ekleyin. Tamamlanan iş onay bekler; yapan kişi kendi işini onaylayamaz. Bir adım reddedildiğinde ilgili önceki adımlar ve bunlara bağlı sonraki işler tekrar açılır.
3. **Tedarikçi Seçimi:** SKU ile ürün ve tedarikçi oluşturun. Ürüne birden çok teklif ekleyin. Aynı ürün, miktar, para birimi ve teslim şartındaki teklifleri karşılaştırın. Seçilen teklifin fiyatı ve şartları PO taslağına kopyalanır. A.B.14 ticari anlaşma onayı ve gerçek PO belgesi olmadan sipariş verildiği doğrulanamaz; ödeme veya tedarikçiye mesaj gönderilmez.
4. **Üretim & Lojistik:** satın alma teslimi stoğu artırır. Fiziksel sayım / açılış stoğu gerekçeyle kaydedilir. Satış siparişi miktarı kadar stok rezerve edilir. Kısmi sevkiyat gerçek miktarı stoktan düşürür. Kalan iptal edildiğinde yalnızca sevk edilmemiş rezervasyon serbest bırakılır.
5. Etiketi taşıyıcınızdan alın; gerçek takip numarası, etiket ve fotoğraf bağlantısını girin. Harici platform güncellemesini kendiniz yaptıktan sonra **Platformda güncelledim** seçin. Bu kayıt API senkronizasyonu iddiasında bulunmaz.
6. **Raporlar:** kayıtlı proje verilerinin yerel özeti, metin dışa aktarımı ve tarayıcı üzerinden PDF/yazdırma. E-posta düğmesi yalnızca kişinin posta uygulamasında taslak açar.

## Veriler ve erişim

- Oturum Firebase Authentication ile doğrulanır. Tarayıcıdaki rol bilgisi yetki kaynağı değildir. Çıkış Firebase oturumunu ve geçici Drive bağlantısını kapatır.
- Müşteri yalnızca atanmış projelerini okur. Freelancer atanmış projelerindeki SOP görevlerini ve kendisine ait adayları kullanır. Profil rolü, proje erişimi ve askıya alma yalnızca yönetici tarafından değiştirilir. Yönetici yetkisi ayrıca doğrulanmış mevcut Auth UID listesi veya güvenilir Admin SDK custom claim gerektirir; profil alanına admin yazmak yetki sağlamaz.
- Eski kayıtlar silinmez veya örnek veriyle değiştirilmez. Önceki lojistik kayıtları salt okunur arşivde görünür; doğrulanmamış eski örnekler yeni stok hesabına katılmaz.
- Yeni Drive yüklemeleri en fazla 10 MB ve desteklenen belge/görsel türlerindedir. Dosyalara `anyone` izni verilmez. Belgeyi görmesi gereken kişilere Drive'ın kendi erişim ayarlarından erişim verilmelidir. Önceden paylaşılmış dosyaların mevcut Drive izinleri ayrıca kontrol edilmelidir.
- Eski kaynakta bulunan örnek şifreler kaldırıldı. Gerçek hesapların şifreleri değiştirilmedi; eski örnek şifre kullanan kullanıcılar giriş ekranından şifrelerini yenilemelidir.

## Ücret sınırı

Yeni ücretli servis, abonelik, kredi satın alma veya ödeme entegrasyonu açılmadı. `/api/ai/*` çağrıları sunucuda kapalıdır; Gemini anahtarı tanımlı olsa bile bu yollar API çağrısı yapmaz. SMS, ücretli e-posta/kargo/pazaryeri API bağlantısı kurulmadı. Mevcut Firebase/Render hesabının mevcut kullanım ve kotası değişmedi; bu geliştirme mevcut servislerin kendi kullanım koşullarını ortadan kaldırmaz.

## Yedek ve kurtarma

`backups/` Git dışında kalır. Canlı değişiklik öncesi alınan tam Firestore yedeği özgün REST alan türlerini ve kuralları korur; SHA-256 ile doğrulanır. Kimlik bilgisi, erişim anahtarı veya parola hash'i yedeğe yazılmaz. Authentication kullanıcılarının yalnızca kimlik/e-posta/durum metaverisi tutulur.

Panelin proje JSON yedeği kullanıcı hesabı ve Drive dosya asıllarını içermez. Geri yükleme aynı projede yalnızca eksik kayıtları tek işlemde ekler; mevcut kayıtları değiştirmez. Görevler yeniden onay gerektirir. Geçersiz eski dosya bağlantıları geri yüklenmez. Tek işlem en fazla 300 kayıt içindir; güvenlik kuralı erişim sınırları aşılırsa hiçbir kayıt eklenmeden hata verilir.

Tam veritabanı kurtarması üretimde körlemesine çalıştırılmamalıdır: yedek önce yerel emülatörde doğrulanmalı, aktif işlemler durdurulmalı ve yalnızca gerekli belgeler geri yüklenmelidir. Eski herkese açık kurallar tekrar yayınlanmamalıdır.

## Kontroller ve yerel test ortamı

```
npm ci
npm run check
npx -y firebase-tools@latest emulators:exec --only firestore --config firebase.test.json --project demo-t2t-security "npm run test:rules"
```

Kurallar emülatörü Java 21 gerektirir. Test proje kimliği `demo-t2t-security` gerçek bulut kaynaklarına erişmez. Arayüz testi için emülatörleri `firestore,auth` ile başlatın (`firebase emulators:start --only firestore,auth --config firebase.test.json --project demo-t2t-security`), ayrı terminalde `export FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9098` ile `node tests/ui-seed.mjs` çalıştırın ve `VITE_USE_EMULATORS=true PORT=3011 npm run dev` ile açın. Ürün reçetesi (A.B.8) için kurgusal Unlu Mamüller verisini ardından `node tests/spec-seed.mjs` ile ekleyin; onay adımları `approver@t2t.test` hesabıyla yapılır. Seed betikleri emülatör değişkenleri yoksa, adres yerel değilse veya proje kimliği `demo-` ile başlamıyorsa hiçbir şey yazmadan durur. Demo hesabı yalnızca emülatördedir; üretim derlemesi bu bağlantıyı etkinleştirmez.

`git config core.hooksPath .githooks` yerel gönderim öncesi tür, iş kuralı testleri ve derleme denetimini etkinleştirir. Otomatik ücretli bulut test çalıştırıcısı etkinleştirilmedi. React hata sınırı hatanın türü ve zamanını tarayıcıda tutar; sunucu `/healthz` durum uç noktasını ve sınırlı hata günlüklerini sağlar. Üçüncü taraf hata izleme aboneliği kullanılmaz.
