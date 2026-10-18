export const logistics = {
  "title": "Üretim & Lojistik iş akışı",
  "heading": "Üretim, Lojistik & Envanter Yönetimi",
  "note": "Siparişten teslimata ve stok planlamaya",
  "groups": {
    "B.A.": {
      "title": "Stratejik proje uyumu ve koordinasyon",
      "subtitle": "Siparişten teslimata sevkiyat koordinasyonu"
    },
    "B.B.": {
      "title": "Envanter planlama ve tahmin",
      "subtitle": "Stok seviyelerini ve tahminleri yönetin"
    }
  },
  "periods": {
    "Her gün takip": "Her gün takip",
    "Her ay": "Her ay",
    "Her hafta": "Her hafta",
    "Gerektiğinde": "Gerektiğinde"
  },
  "steps": {
    "B.A.1": {
      "name": "Satın Alma Siparişi (PO)",
      "kpi": "PO Doğruluğu (%100)",
      "output": "İmzalı Satın Alma Siparişi üreticiye gönderildi"
    },
    "B.A.2": {
      "name": "PO Onay Durumu",
      "kpi": "Sipariş onayının tamamlanması",
      "output": "İmzalı PO Onayı"
    },
    "B.A.3": {
      "name": "İmzalı Proforma Fatura",
      "kpi": "Proforma fatura ve PO %100 eşleşmeli",
      "output": "Alınan Proforma Fatura"
    },
    "B.A.4": {
      "name": "Ürün Hazır Olma Tarihi",
      "kpi": "Teslim süresine uygun ürün hazır olma tarihinin eşleştirilmesi (%95)",
      "output": "Hazır Olma Tarihi Onay E-postası."
    },
    "B.A.5": {
      "name": "Avans Ödemesi",
      "kpi": "Ödeme İşlemi",
      "output": "Ödeme Kanıtı / SWIFT Belgesi"
    },
    "B.A.6": {
      "name": "Sevkiyat Hazırlık Toplantısı",
      "kpi": "Üreticinin lojistik departmanı (ve varsa üreticinin gümrük müşaviri acentesi)",
      "output": "Sevkiyat Toplantı Notları"
    },
    "B.A.7": {
      "name": "Kritik Kontrol Noktası – Hammadde",
      "kpi": "Gerekli aşama onayları tamamlandı (%100) - Hammadde tedariki doğrulandı",
      "output": "Ham Madde Onay Kontrol Listesi"
    },
    "B.A.8": {
      "name": "Kritik Kontrol Noktası – Ambalaj",
      "kpi": "Gerekli aşama onayları tamamlandı (%100) - Ambalaj malzemeleri tesise ulaştı ve onaylandı",
      "output": "Ambalaj Malzemesi Onay Kontrol Listesi"
    },
    "B.A.9": {
      "name": "Kritik Kontrol Noktası – Üretim Bitişi",
      "kpi": "Kritik aşamaların onayı (%100) - Üretim tamamlandı",
      "output": "Üretim Sonuçlandırma Kontrol Listesi"
    },
    "B.A.10": {
      "name": "Kalan Ödeme",
      "kpi": "Kalan ödeme anlaşılan ödeme koşulları içinde yapıldı",
      "output": "Kalan ödeme dekontu / SWIFT"
    },
    "B.A.11": {
      "name": "Lojistik Rezervasyon Durumu",
      "kpi": "Onaylanmış (Gemi/Tır) rezervasyon tarihi",
      "output": "Onaylanmış Rezervasyon Referansı / BL Taslağı"
    },
    "B.A.12": {
      "name": "Çıkış Onayı (Tır/Gemi)",
      "kpi": "Belge ve yükleme kontrolünden sonra sevkiyata çıkış onayı verildi",
      "output": "İhracat resmi belgeleri (Ticari Fatura, Çeki Listesi, Gümrük Beyannamesi)"
    },
    "B.A.13": {
      "name": "Gerekli Belge Kontrol Listesi",
      "kpi": "İhracat Gümrük Belgelerinin İncelenmesi",
      "output": "Ticari Fatura, Çeki Listesi, Konşimento (BL), Menşe Şahadetnamesi ve konteyner takip numarasının onaylanması"
    },
    "B.A.14": {
      "name": "Gümrük Müşaviri Katılımı",
      "kpi": "Tüm belgelerin ithalat müşaviri ile paylaşılması",
      "output": "Gümrük Müşaviri Katılım Onay E-postası"
    },
    "B.A.15": {
      "name": "Sevkiyat Teslimat Onayı",
      "kpi": "Zamanında Teslimat",
      "output": "Nakliyeci tarafından gönderilen teslimat onay bildirimi"
    },
    "B.B.1": {
      "name": "Güvenlik Stoğunun Belirlenmesi",
      "kpi": "Stokta kaç günlük envanter tutmak istiyoruz. Güvenlik Stoğu Hesaplama doğruluğu (%95)",
      "output": "Güvenlik Stoğu Hesaplama Excel Raporu"
    },
    "B.B.2": {
      "name": "Satış Tahminleri",
      "kpi": "Tahminler tüm satış platformlarından toplanır (B2C + B2B tahmini) Tahmin Doğruluğu (En az %85)",
      "output": "Aylık Satış Tahmin Raporu"
    },
    "B.B.3": {
      "name": "Mevcut Fiziksel Stoğun Belirlenmesi",
      "kpi": "Depodaki fiili fiziksel miktar aylık olarak kontrol edilir",
      "output": "Fiziksel stok sayım raporu"
    },
    "B.B.4": {
      "name": "Taahhüt Edilen Stoğun Belirlenmesi",
      "kpi": "Onaylanmış B2C satışları veya onaylanmış B2B Satın Alma Siparişleri (PO'lar) için ayrılan miktar Doğruluğu (%100)",
      "output": "Açık Satış Siparişleri Listesi"
    },
    "B.B.5": {
      "name": "Kullanılabilir Stok Raporu",
      "kpi": "Kullanılabilir = B.B.3 − B.B.4",
      "output": "Kullanılabilir Stok Excel Dosyası"
    },
    "B.B.6": {
      "name": "Yeniden Sipariş Noktası",
      "kpi": "Yeniden sipariş noktası: (Tahmini Günlük Satış x Tedarikçi Teslim Süresi) + Güvenlik Stoğu Seviyesi",
      "output": "Sipariş noktası hesaplama tablosu"
    }
  }
};
