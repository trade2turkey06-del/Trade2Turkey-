import { percent } from "../percent";
// CodedError kodlarının metinleri (src/i18n/errors.ts). Parametreler her zaman metin olarak gelir.
type P = Record<string, string>;
export const errors = {
  // domain/workflow.ts → validateCompletion
  completionPeople: "Görev sorumlusu ve onaylayan farklı kişiler olmalı.",
  completionDueDate: "Hedef bitiş tarihi seçin.",
  completionEvidence: "Gerekli çıktı için gerçek belge adı ve HTTPS bağlantısı ekleyin.",
  // IntroductionMeetingEditor → validateMeetings
  meetingsNone: "Tamamlamak için en az bir tanışma toplantısı ekleyin.",
  meetingsManufacturer: "Her toplantı için üretici adını girin.",
  meetingsOpenTopics: (p: P) => `${p.name}: şu konular henüz konuşulmadı: ${p.topics}`,
  // domain/rfqMatrix.ts → validateMatrix
  matrixManufacturers: (p: P) => `Matriste ${p.min}–${p.max} üretici olmalı.`,
  matrixNames: "Her üreticinin bir adı olmalı.",
  matrixWeights: (p: P) => `Bölüm ağırlıklarının toplamı %100 olmalı (şu an ${percent(Number(String(p.total).replace(",", ".")), "tr")}).`,
  matrixCriterionWeights: "Kriter ağırlıkları 0 veya daha büyük olmalı.",
  matrixScores: "Puanlar 1 ile 5 arasında tam sayı olmalı.",
  // SourcingWorkflow kayıt / onay akışı
  rfqTooLarge: "RFQ formları çok büyük. Lütfen uzun yanıtları belge bağlantısı olarak ekleyin.",
  companyNameMissing: "Lütfen listedeki her firmanın adını girin veya boş firmayı çıkarın.",
  companiesTooLarge: "Firma listesi çok büyük. Lütfen uzun notları kısaltın.",
  meetingsTooLarge: "Toplantı notları çok büyük. Lütfen uzun notları belge bağlantısı olarak ekleyin.",
  matrixTooLarge: "RFQ matrisi çok büyük. Uzun değerleri veya notları kısaltın.",
  costingTooLarge: "Maliyet tablosu çok büyük. Lütfen uzun açıklamaları kısaltın.",
  costLinesTooLarge: "Maliyet satırları çok büyük.",
  specTooLarge: "Özellik formu çok büyük. Lütfen uzun içerikleri belge bağlantısı olarak ekleyin.",
  conflict: "Bu adım başka bir oturumda değişti. Güncel kaydı kontrol edip yeniden deneyin.",
  prerequisites: (p: P) => `Önce şu adımlar tamamlanıp onaylanmalı: ${p.ids}`,
  noEditRight: "Bu görevi düzenleme yetkiniz yok.",
  approvedLocked: "Onaylı kayıt değiştirilemez. Önce onaylayan gerekçeli iade yapmalı.",
  onlyApprover: "Yalnızca atanmış onaylayan karar verebilir; işlemi yapan kişi kendi işini onaylayamaz.",
  notPending: "Bu kayıt onay beklemiyor.",
  rejectReasonMissing: "Ret / iade gerekçesini yazın.",
  newPeriodOnlyApproved: "Yeni dönem yalnızca onaylanmış adımda başlatılabilir.",
  periodHistoryFull: "Dönem geçmişi dolu (200). Eski dönemleri arşivleyin.",
  shortlistLocked: "A.A.5 kısa listesi onayda veya onaylı; değiştirilemez.",
  ab7Required: "A.B.7'yi tamamlamak için yüksek potansiyelli üreticiyi seçin.",
  ab8Required: "A.B.8'i onaya göndermek için seçili üreticinin onaylı reçetesini bağlayın.",
  signIn: "Oturum açın.",
};
