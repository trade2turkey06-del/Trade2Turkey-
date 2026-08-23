/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SopStep {
  id: string; // e.g. "A.A.1", "B.A.4"
  section: "A" | "B";
  subsection: string; // e.g. "A.A: Discovery and Feasibility", "B.A: Project Execution & Logistics"
  task: string;
  requester: string;
  taskOwner: string;
  status: "Completed" | "In Progress" | "Pending" | "Rejected";
  kpiMetric: string;
  kpiTimeDays: number | string; // can be "Eveeryday Follow Up", "Every Month", etc.
  dateStart: string;
  desiredDateEnd: string;
  actualDateEnd: string;
  approved: "Approved" | "Pending" | "Rejected" | "";
  approver: string;
  requiredOutputs: string;
  storageLocation: string;
  previousStepId?: string;
  minorSheetKey?: string; // Links to minor sheet if applicable (e.g. "target-specs", "rfq-comp")
}

export interface TargetSpecification {
  id: string;
  productName: string;
  category: string;
  dimensionsWidth: number;
  dimensionsLength: number;
  dimensionsHeight: number;
  materialCover: string;
  materialFilling: string;
  colorOptions: string[];
  weightKg: number;
  certifiedStandards: string[];
  targetExwPrice: number;
  targetFobPrice: number;
  packagingDetails: string;
  notes: string;
  lastUpdated: string;
}

export interface SupplierRfq {
  id: string;
  supplierName: string;
  location: string;
  sampleCost: number;
  leadTimeDays: number;
  paymentTerms: string;
  initialQuoteExw: number;
  hasNda: boolean;
  notes: string;
}

export interface RfqSubmission {
  id: string;
  rfcCode: string; // e.g., RFQ-2026-BEANBAG
  productName: string;
  dateSent: string;
  targetQty: number;
  status: "Sent" | "Quote Received" | "Reviewing" | "Approved" | "Declined";
  suppliers: SupplierRfq[];
}

export interface ValueChainCosting {
  id: string;
  productName: string;
  quantity: number;
  exwUnitPrice: number;
  domesticFreightTurkey: number;
  exportCustomsTurkey: number;
  oceanFreight: number;
  importCustomsDuty: number; // percentage, e.g. 8 for 8%
  importerBrokerageAndClerance: number;
  localWarehousingAndHandling: number;
  inlandDelivery: number;
  unexpectedBuffer: number;
}

export interface RfqComparativeMatrix {
  id: string;
  productName: string;
  criteriaWeights: {
    unitPrice: number; // percentage
    leadTime: number;
    quality: number;
    financialStability: number;
  };
  suppliers: {
    name: string;
    unitPriceExw: number;
    leadTimeDays: number;
    qualityScore: number; // 1-10
    paymentTermsScore: number; // 1-10
    commScore: number; // 1-10
    complianceScore: number; // 1-10
    totalWeightScore?: number;
    responses?: Record<string, string>;
    scores?: Record<string, number>;
  }[];
}

export interface RecipeMaterial {
  id: string;
  name: string;
  qtyRequired: number; // e.g. 3.2
  unit: string; // e.g. "kg", "metre", "adet"
  unitCostUsd: number; // e.g. 1.50
  scrapRatePercent: number; // e.g. 5 for 5%
  source: string; // e.g. "Local Turkish Fabric LLC"
}

export interface ProductRecipe {
  id: string;
  productName: string;
  version: string;
  materials: RecipeMaterial[];
  laborCostUsd: number;
  packagingCostUsd: number;
  overheadCostUsd: number;
  targetExwCost: number;
  lastUpdated: string;
}

export interface Supplier {
  id: string;
  name: string;
  city: string;
  country: string;
  mainCategory: string;
  scores: {
    quality: number;       // Max 100, weight 40%
    pricing: number;       // Max 100, weight 25%
    delivery: number;      // Max 100, weight 20%
    communication: number; // Max 100, weight 15%
  };
  capacityMonthly: number;
  employees: number;
  verifiedStatus: "Gold" | "Verified" | "Pending" | "High Risk";
  ndaSigned: boolean;
  sampleApproved: boolean;
  siteAuditCompleted: boolean;
  auditScorePercent: number;
  evidenceFiles: {
    name: string;
    category: "NDA" | "Audit Report" | "Certificate" | "Sample Spec";
    dateAdded: string;
    size: string;
    downloadUrl: string;
  }[];
}

export interface ShipmentMilestone {
  id: string;
  shipmentNumber: string; // e.g. T2T-SHP-1002
  productName: string;
  supplierName: string;
  containerId: string;
  vesselName: string;
  originPort: string; // e.g. Port of Ambarli, Istanbul
  destinationPort: string; // e.g. Port of Rotterdam
  status: "Draft" | "Booking Confirmed" | "Pre-production" | "Production Complete" | "Loaded on Vessel" | "Transit" | "Customs Clearance" | "Delivered";
  latitude: number; // Current location on map (or simulated coordinates)
  longitude: number;
  departureDate: string;
  estimatedArrival: string;
  currentMilestoneIndex: number;
  milestones: {
    title: string;
    date: string;
    completed: boolean;
    description: string;
    status?: "Bekliyor" | "Devam Ediyor" | "Tamamlandı";
  }[];
  cargoPhotos: {
    id: string;
    title: string;
    url: string;
    timestamp: string;
  }[];
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  safetyStockDays: number;
  forecastDailySales: number;
  physicalStock: number;
  committedStock: number;
  leadTimeDays: number;
}

export interface FulfillmentOrder {
  id: string;
  platform: "Amazon" | "Walmart" | "Shopify Web Sitesi";
  orderId: string;
  sku: string;
  customerName: string;
  shippingAddress: string;
  shippingRates: { carrier: string; rate: number; duration: string }[];
  selectedRate?: { carrier: string; rate: number; duration: string };
  shippingLabelUrl?: string;
  cargoProofPhotoUrl?: string;
  trackingNumber?: string;
  status: "Kontrol Bekliyor" | "Stock Verified" | "Labeiled" | "Shipped" | "Senkronize Edildi";
  dateReceived: string;
}

// Initial Mock Data Sets
export const INITIAL_SOP_STEPS: SopStep[] = [
  {
    section: "A",
    subsection: "Bölüm A.A: Tedarik: Keşif ve Fizibilite",
    requiredOutputs: "Proje Bilgi Formu (Eksiksiz), B2B müşterisinden toplantı tutanakları",
    storageLocation: "Ortak Klasör - Unlu Mamüller Projesi - Toplantı Notları",
    kpiTimeDays: 6,
    approved: "Approved",
    desiredDateEnd: "2026-05-16",
    id: "A.A.1",
    kpiMetric: "Proje Bilgileri Eksiksiz Toplama Oranı",
    actualDateEnd: "2026-05-15",
    status: "In Progress",
    taskOwner: "Proje Yöneticisi",
    requester: "Genel Müdür",
    dateStart: "2026-05-10",
    task: "Proje Başlangıç Bilgilerinin Onaylanması",
    approver: "Genel Müdür"
  },
  {
    kpiMetric: "Ürün özelliklerinin oluşturulması",
    section: "A",
    subsection: "Bölüm A.A: Tedarik: Keşif ve Fizibilite",
    requiredOutputs: "Onaylanmış Hedef Ürün Özellikleri",
    storageLocation: "Ortak Klasör - Unlu Mamüller Projesi - Hedef Ürün Özellikleri",
    kpiTimeDays: 8,
    desiredDateEnd: "2026-05-23",
    approved: "Approved",
    previousStepId: "A.A.1",
    id: "A.A.2",
    minorSheetKey: "target-specs",
    requester: "Genel Müdür",
    dateStart: "2026-05-15",
    task: "Hedef Ürün Özelliklerinin Oluşturulması",
    approver: "Genel Müdür",
    actualDateEnd: "2026-05-22",
    status: "Completed",
    taskOwner: "Proje Yöneticisi"
  },
  {
    taskOwner: "Tedarik Yöneticisi",
    status: "Completed",
    actualDateEnd: "2026-05-29",
    dateStart: "2026-05-22",
    requester: "Genel Müdür",
    approver: "Genel Müdür",
    task: "İlk Araştırma ve Geniş Tedarikçi Listesi",
    previousStepId: "A.A.2",
    approved: "Approved",
    desiredDateEnd: "2026-05-30",
    kpiTimeDays: 8,
    subsection: "Bölüm A.A: Tedarik: Keşif ve Fizibilite",
    requiredOutputs: "Üreticilerin İlk Geniş Listesi",
    storageLocation: "Ortak Klasör - Unlu Mamüller Projesi - Üretici Geniş Listesi",
    section: "A",
    id: "A.A.3",
    kpiMetric: "Tedarikçi Araştırma Kapsamı (Min 10 Üretici)"
  },
  {
    requester: "Genel Müdür",
    dateStart: "2026-05-29",
    minorSheetKey: "rfq-submission",
    task: "Teklif Talebi (RFQ) Gönderimi",
    approver: "Genel Müdür",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi",
    actualDateEnd: "2026-06-05",
    kpiMetric: "Teklif Talebi formu tedarikçilere gönderildi ve Yanıt Oranı %70",
    desiredDateEnd: "2026-06-06",
    approved: "Approved",
    previousStepId: "A.A.3",
    section: "A",
    storageLocation: "Ortak Klasör - Unlu Mamüller Projesi - Tedarikçi Değerlendirme Formları",
    requiredOutputs: "Doldurulmuş Teklif Talebi (RFQ) formları",
    subsection: "Bölüm A.A: Tedarik: Keşif ve Fizibilite",
    kpiTimeDays: 8,
    id: "A.A.4"
  },
  {
    approved: "Approved",
    desiredDateEnd: "2026-06-07",
    previousStepId: "A.A.4",
    section: "A",
    subsection: "Bölüm A.A: Tedarik: Keşif ve Fizibilite",
    requiredOutputs: "E-posta veya liste olarak kısa listeye alınan şirketler",
    storageLocation: "Ortak Klasör - Unlu Mamüller Projesi - Kısa Liste",
    kpiTimeDays: 2,
    id: "A.A.5",
    kpiMetric: "En Az 3 Firmalık Kısa Liste",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi",
    actualDateEnd: "2026-06-07",
    requester: "Genel Müdür",
    dateStart: "2026-06-05",
    task: "Üretici Kısa Listesi",
    approver: "Genel Müdür"
  },
  {
    approver: "Tedarik Yöneticisi",
    task: "Maliyetlendirme - Değer Zinciri",
    requester: "Genel Müdür",
    dateStart: "2026-06-07",
    minorSheetKey: "costing-value-chain",
    taskOwner: "Genel Müdür",
    status: "Completed",
    actualDateEnd: "2026-06-09",
    kpiMetric: "%95 doğru maliyetlendirme",
    id: "A.A.6",
    previousStepId: "A.A.5",
    desiredDateEnd: "2026-06-09",
    approved: "Approved",
    kpiTimeDays: 2,
    requiredOutputs: "Nihai Değer Zinciri Excel Raporu",
    storageLocation: "Ortak Klasör - Unlu Mamüller Projesi - Değer Zinciri Maliyetlendirmesi",
    subsection: "Bölüm A.A: Tedarik: Keşif ve Fizibilite",
    section: "A"
  },
  {
    previousStepId: "A.A.1",
    approved: "Approved",
    desiredDateEnd: "2026-06-15",
    kpiTimeDays: 6,
    section: "A",
    subsection: "Bölüm A.A: Tedarik: Keşif ve Fizibilite",
    storageLocation: "Ortak Klasör - Proje Karar Günlüğü",
    requiredOutputs: "Projenin değerini, geri dönüş potansiyelini (ROI) ve rekabet ortamı raporunu belirler",
    id: "A.A.7",
    kpiMetric: "Proje Devam/Tamam Kararı Durumu",
    taskOwner: "Genel Müdür",
    status: "Completed",
    actualDateEnd: "2026-06-14",
    dateStart: "2026-06-09",
    requester: "Genel Müdür",
    approver: "Genel Müdür",
    task: "Proje Devam/Tamam Kararı"
  },
  {
    approver: "Genel Müdür",
    task: "Gizlilik Sözleşmesi (NDA)",
    requester: "Proje Yöneticisi",
    dateStart: "2026-06-15",
    actualDateEnd: "2026-06-16",
    taskOwner: "Tedarik Yöneticisi",
    status: "Completed",
    kpiMetric: "Kısa Listedeki Şirketlerle NDA İmzalanması",
    id: "A.B.1",
    kpiTimeDays: 2,
    section: "A",
    subsection: "Bölüm A.B: Tedarik: Teklif, Kalite ve Uyumluluk",
    storageLocation: "Ortak Klasör - İmzalı NDA Kasası",
    requiredOutputs: "Karşılıklı İmzalanmış NDA",
    previousStepId: "A.A.5",
    approved: "Approved",
    desiredDateEnd: "2026-06-17"
  },
  {
    actualDateEnd: "2026-06-18",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi",
    requester: "Proje Yöneticisi",
    dateStart: "2026-06-16",
    task: "Tanışma Toplantısı",
    approver: "Genel Müdür",
    section: "A",
    subsection: "Bölüm A.B: Tedarik: Teklif, Kalite ve Uyumluluk",
    requiredOutputs: "Her üretici için takip notları",
    storageLocation: "Ortak Klasör - Toplantı Tutanakları",
    kpiTimeDays: 2,
    approved: "Approved",
    desiredDateEnd: "2026-06-18",
    id: "A.B.2",
    kpiMetric: "Kısa listedeki şirketlerin %100 toplantı katılımı"
  },
  {
    id: "A.B.3",
    desiredDateEnd: "2026-06-20",
    approved: "Approved",
    section: "A",
    subsection: "Bölüm A.B: Tedarik: Teklif, Kalite ve Uyumluluk",
    storageLocation: "Ortak Klasör - Numune Talep Belgeleri",
    requiredOutputs: "Tamamlanmış ve Onaylanmış Numune Talep Formu",
    kpiTimeDays: 2,
    kpiMetric: "Doğru form ile numune talebi işlemleri",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi",
    actualDateEnd: "2026-06-20",
    task: "Numune Talep Formu",
    approver: "Genel Müdür",
    requester: "Proje Yöneticisi",
    dateStart: "2026-06-18"
  },
  {
    task: "Numune Onay veya Red Güncellemesi",
    approver: "Genel Müdür",
    requester: "Proje Yöneticisi",
    dateStart: "2026-06-20",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi",
    actualDateEnd: "2026-06-25",
    kpiMetric: "Numune incelemesinin tamamlanması",
    id: "A.B.4",
    desiredDateEnd: "2026-06-26",
    approved: "Approved",
    previousStepId: "A.B.3",
    storageLocation: "Ortak Klasör - Kalite Kontrol Onayları",
    requiredOutputs: "Numune incelemesine ilişkin notlar",
    subsection: "Bölüm A.B: Tedarik: Teklif, Kalite ve Uyumluluk",
    section: "A",
    kpiTimeDays: 6
  },
  {
    requester: "Proje Yöneticisi",
    dateStart: "2026-06-25",
    task: "SMM (COGS) Detay Sayfası",
    approver: "Genel Müdür",
    actualDateEnd: "2026-06-30",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi",
    kpiMetric: "SMM (COGS) Detay Sayfası kısa listedeki her üretici tarafından oluşturulur ve gönderilir",
    section: "A",
    subsection: "Bölüm A.B: Tedarik: Teklif, Kalite ve Uyumluluk",
    storageLocation: "Ortak Klasör - SMM (COGS) Sayfaları",
    requiredOutputs: "Her üreticinin maliyet detaylarına sahip olma",
    kpiTimeDays: 6,
    approved: "Approved",
    desiredDateEnd: "2026-07-01",
    previousStepId: "A.B.4",
    id: "A.B.5"
  },
  {
    actualDateEnd: "2026-07-05",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi",
    minorSheetKey: "rfq-comparative-matrix",
    dateStart: "2026-06-30",
    requester: "Proje Yöneticisi",
    task: "RFQ Karşılaştırma Matrisi",
    approver: "Genel Müdür",
    section: "A",
    subsection: "Bölüm A.B: Tedarik: Teklif, Kalite ve Uyumluluk",
    storageLocation: "Ortak Klasör - Karşılaştırma Matrisi Kasası",
    requiredOutputs: "Güncel RFQ Karşılaştırma Matrisi",
    kpiTimeDays: 6,
    desiredDateEnd: "2026-07-06",
    approved: "Approved",
    id: "A.B.6",
    kpiMetric: "Veri girişinin eksiksiz yapılması"
  },
  {
    kpiMetric: "En az 1 yüksek potansiyelli tedarikçiye sahip olma",
    id: "A.B.7",
    section: "A",
    subsection: "Bölüm A.B: Tedarik: Teklif, Kalite ve Uyumluluk",
    requiredOutputs: "En az 1 yüksek potansiyelli tedarikçinin belirlenmesi",
    storageLocation: "Ortak Klasör - Tedarik Seçim Günlükleri",
    kpiTimeDays: 6,
    approved: "Approved",
    desiredDateEnd: "2026-07-11",
    previousStepId: "A.B.5",
    task: "Yüksek Potansiyelli Tedarikçinin Belirlenmesi",
    approver: "Genel Müdür",
    dateStart: "2026-07-05",
    requester: "Proje Yöneticisi",
    actualDateEnd: "2026-07-10",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi"
  },
  {
    kpiTimeDays: 6,
    section: "A",
    storageLocation: "Ortak Klasör - Ürün Reçeteleri",
    requiredOutputs: "Detaylı Malzeme Maliyeti Kırılım Sayfası",
    subsection: "Bölüm A.B: Tedarik: Teklif, Kalite ve Uyumluluk",
    previousStepId: "A.B.5",
    desiredDateEnd: "2026-07-16",
    approved: "Approved",
    id: "A.B.8",
    kpiMetric: "Eksiksiz malzeme listesi içeren ürün reçetesi oluşturma (%100)",
    actualDateEnd: "2026-07-15",
    taskOwner: "Tedarik Yöneticisi",
    status: "Completed",
    minorSheetKey: "creation-product-recipe",
    requester: "Proje Yöneticisi",
    dateStart: "2026-07-10",
    approver: "Genel Müdür",
    task: "Ürün Reçetesinin Oluşturulması"
  },
  {
    actualDateEnd: "2026-07-20",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi",
    task: "Reçetedeki Malzemelerin Maliyetlendirilmesi",
    approver: "Genel Müdür",
    minorSheetKey: "costing-materials-recipe",
    requester: "Proje Yöneticisi",
    dateStart: "2026-07-15",
    id: "A.B.9",
    section: "A",
    subsection: "Bölüm A.B: Tedarik: Teklif, Kalite ve Uyumluluk",
    requiredOutputs: "Hedef ürün hakkında net maliyet sayfasına sahip olma",
    storageLocation: "Ortak Klasör - Ayrıntılı Maliyetlendirme Sayfası",
    kpiTimeDays: 6,
    approved: "Approved",
    desiredDateEnd: "2026-07-21",
    previousStepId: "A.B.8",
    kpiMetric: "Her malzemenin maliyet doğruluğu (%100)"
  },
  {
    taskOwner: "Tedarik Yöneticisi",
    status: "Completed",
    actualDateEnd: "2026-07-29",
    approver: "Genel Müdür",
    task: "Nihai Özellikler ve Maliyetlendirme",
    requester: "Proje Yöneticisi",
    dateStart: "2026-07-20",
    id: "A.B.10",
    previousStepId: "A.A.2/A.B.5",
    desiredDateEnd: "2026-07-30",
    approved: "Approved",
    kpiTimeDays: 10,
    storageLocation: "Ortak Klasör - Nihai Özellikler",
    requiredOutputs: "Onaylanmış Nihai Özellikler ve Maliyet Belgesi",
    subsection: "Bölüm A.B: Tedarik: Teklif, Kalite ve Uyumluluk",
    section: "A",
    kpiMetric: "Hedef ve nihai maliyet arasındaki fark (Maks %10)"
  },
  {
    kpiMetric: "Fabrikayı mümkün olduğunca detaylı denetleme",
    id: "A.B.11",
    section: "A",
    storageLocation: "Ortak Klasör - Fabrika Denetim Raporları",
    requiredOutputs: "Fabrika Denetim Raporu / Yerinde Ziyaret Özeti",
    subsection: "Bölüm A.B: Tedarik: Teklif, Kalite ve Uyumluluk",
    kpiTimeDays: 4,
    desiredDateEnd: "2026-08-02",
    approved: "Approved",
    previousStepId: "A.B.7",
    task: "Yerinde Ziyaret ile Denetim",
    approver: "Genel Müdür",
    requester: "Proje Yöneticisi",
    dateStart: "2026-07-29",
    actualDateEnd: "2026-08-01",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi"
  },
  {
    section: "A",
    storageLocation: "Ortak Klasör - İmzalı Proje Başlatma Formu",
    requiredOutputs: "Projeye başlamak için yazılı onay",
    subsection: "Bölüm A.B: Tedarik: Teklif, Kalite ve Uyumluluk",
    kpiTimeDays: 12,
    desiredDateEnd: "2026-08-13",
    approved: "Approved",
    previousStepId: "A.A.7",
    id: "A.B.12",
    kpiMetric: "Kritik Kontrol: Değer zinciri, Ürün özellikleri, Finans ve Piyasa koşullarının kontrolü",
    actualDateEnd: "2026-08-12",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi",
    requester: "Proje Yöneticisi",
    dateStart: "2026-08-01",
    task: "Nihai Onay - Kritik Kontrol Noktası",
    approver: "Genel Müdür"
  },
  {
    kpiMetric: "Stok kodları (SKU), etiket ve teknik özellikler her iki taraf için de %100 net olmalıdır",
    kpiTimeDays: 6,
    section: "A",
    subsection: "Bölüm A.B: Tedarik: Teklif, Kalite ve Uyumluluk",
    requiredOutputs: "Stok kodları, etiket ve teknik özellikler standart belge olarak oluşturulmuştur",
    storageLocation: "Ortak Klasör - Üretim Öncesi Toplantı Tutanakları",
    approved: "Approved",
    desiredDateEnd: "2026-08-18",
    id: "A.B.13",
    requester: "Proje Yöneticisi",
    dateStart: "2026-08-12",
    approver: "Genel Müdür",
    task: "Üretim Öncesi Toplantı",
    actualDateEnd: "2026-08-17",
    taskOwner: "Tedarik Yöneticisi",
    status: "Completed"
  },
  {
    desiredDateEnd: "2026-08-21",
    approved: "Approved",
    previousStepId: "A.B.11",
    section: "A",
    storageLocation: "Ortak Klasör - İmzalı Sözleşmeler",
    requiredOutputs: "Karşılıklı İmzalanmış Ticari Sözleşme",
    subsection: "Bölüm A.B: Tedarik: Teklif, Kalite ve Uyumluluk",
    kpiTimeDays: 4,
    id: "A.B.14",
    kpiMetric: "Sözleşmenin Yürürlüğe Girmesi",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi",
    actualDateEnd: "2026-08-20",
    requester: "Proje Yöneticisi",
    dateStart: "2026-08-17",
    task: "Ticari Anlaşma",
    approver: "Genel Müdür"
  },
  {
    taskOwner: "Tedarik Yöneticisi",
    status: "Completed",
    actualDateEnd: "2026-08-24",
    dateStart: "2026-08-21",
    requester: "Proje Yöneticisi",
    approver: "Genel Müdür",
    task: "Satın Alma Siparişi (PO)",
    desiredDateEnd: "2026-08-25",
    approved: "Approved",
    kpiTimeDays: 4,
    section: "B",
    storageLocation: "Ortak Klasör - Gönderilen PO'lar",
    requiredOutputs: "İmzalı Satın Alma Siparişi üreticiye gönderildi",
    subsection: "Bölüm B.A: Stratejik Proje Hizalama ve Koordinasyon",
    id: "B.A.1",
    kpiMetric: "PO Doğruluğu (%100)"
  },
  {
    requester: "Proje Yöneticisi",
    dateStart: "2026-08-24",
    task: "PO Onay Durumu",
    approver: "Genel Müdür",
    actualDateEnd: "2026-08-25",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi",
    kpiMetric: "Sipariş onayının tamamlanması",
    subsection: "Bölüm B.A: Stratejik Proje Hizalama ve Koordinasyon",
    requiredOutputs: "İmzalı PO Onayı",
    storageLocation: "Ortak Klasör - Onaylanan PO'lar",
    section: "B",
    kpiTimeDays: 2,
    approved: "Approved",
    desiredDateEnd: "2026-08-26",
    previousStepId: "B.A.1",
    id: "B.A.2"
  },
  {
    kpiMetric: "Proforma fatura ve PO %100 eşleşmeli",
    id: "B.A.3",
    kpiTimeDays: 2,
    requiredOutputs: "Alınan Proforma Fatura",
    storageLocation: "Ortak Klasör - Proforma Faturalar",
    subsection: "Bölüm B.A: Stratejik Proje Hizalama ve Koordinasyon",
    section: "B",
    previousStepId: "B.A.2",
    desiredDateEnd: "2026-08-27",
    approved: "Approved",
    approver: "Genel Müdür",
    task: "İmzalı Proforma Fatura",
    requester: "Proje Yöneticisi",
    dateStart: "2026-08-25",
    actualDateEnd: "2026-08-27",
    taskOwner: "Tedarik Yöneticisi",
    status: "Completed"
  },
  {
    kpiMetric: "Teslim süresine uygun ürün hazır olma tarihinin eşleştirilmesi (%95)",
    approved: "Approved",
    desiredDateEnd: "2026-08-29",
    previousStepId: "B.A.3",
    section: "B",
    subsection: "Bölüm B.A: Stratejik Proje Hizalama ve Koordinasyon",
    storageLocation: "Tedarik E-postaları - Onaylar",
    requiredOutputs: "Hazır Olma Tarihi Onay E-postası.",
    kpiTimeDays: 2,
    id: "B.A.4",
    requester: "Proje Yöneticisi",
    dateStart: "2026-08-27",
    task: "Ürün Hazır Olma Tarihi",
    approver: "Genel Müdür",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi",
    actualDateEnd: "2026-08-28"
  },
  {
    approver: "Genel Müdür",
    task: "Avans Ödemesi",
    requester: "Proje Yöneticisi",
    dateStart: "2026-08-29",
    actualDateEnd: "2026-08-30",
    taskOwner: "Tedarik Yöneticisi",
    status: "Completed",
    kpiMetric: "Ödeme İşlemi",
    id: "B.A.5",
    kpiTimeDays: 2,
    section: "B",
    subsection: "Bölüm B.A: Stratejik Proje Hizalama ve Koordinasyon",
    requiredOutputs: "Ödeme Kanıtı / SWIFT Belgesi",
    storageLocation: "Finans Klasörü - SWIFT Belgeleri",
    approved: "Approved",
    desiredDateEnd: "2026-08-31"
  },
  {
    kpiMetric: "Üreticinin lojistik departmanı (ve varsa üreticinin gümrük müşaviri acentesi)",
    id: "B.A.6",
    approved: "Approved",
    desiredDateEnd: "2026-09-02",
    kpiTimeDays: 2,
    section: "B",
    subsection: "Bölüm B.A: Stratejik Proje Hizalama ve Koordinasyon",
    requiredOutputs: "Sevkiyat Toplantı Notları",
    storageLocation: "Lojistik Klasörü - Sevkiyat Notları",
    approver: "Genel Müdür",
    task: "Sevkiyat Hazırlık Toplantısı",
    dateStart: "2026-08-31",
    requester: "Proje Yöneticisi",
    taskOwner: "Tedarik Yöneticisi",
    status: "Completed",
    actualDateEnd: "2026-09-01"
  },
  {
    kpiMetric: "Kritik aşamaların onayı (%100) - Ham Madde Tedariği, ambalajların varışı",
    id: "B.A.7",
    approved: "Approved",
    desiredDateEnd: "2026-09-10",
    previousStepId: "B.A.6",
    section: "B",
    subsection: "Bölüm B.A: Stratejik Proje Hizalama ve Koordinasyon",
    requiredOutputs: "Ham Madde Onay Kontrol Listesi",
    storageLocation: "Kalite Kontrol Merkezi - Günlük Raporlar",
    kpiTimeDays: "Everyday Follow Up",
    task: "Kritik Kontrol Noktası Geçildi (Ham Maddeler)",
    approver: "Genel Müdür",
    requester: "Proje Yöneticisi",
    dateStart: "2026-09-01",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi",
    actualDateEnd: "2026-09-09"
  },
  {
    actualDateEnd: "2026-09-12",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi",
    requester: "Proje Yöneticisi",
    dateStart: "2026-09-01",
    task: "Kritik Kontrol Noktası Geçildi (Ambalaj)",
    approver: "Genel Müdür",
    section: "B",
    storageLocation: "Kalite Kontrol Merkezi - Ambalaj Onayları",
    requiredOutputs: "Ambalaj Malzemesi Onay Kontrol Listesi",
    subsection: "Bölüm B.A: Stratejik Proje Hizalama ve Koordinasyon",
    kpiTimeDays: "Everyday Follow Up",
    desiredDateEnd: "2026-09-12",
    approved: "Approved",
    previousStepId: "B.A.6",
    id: "B.A.8",
    kpiMetric: "Kritik aşamaların onayı (%100) - Ambalaj malzemelerinin tesise varışı"
  },
  {
    kpiMetric: "Kritik aşamaların onayı (%100) - Üretim tamamlandı",
    id: "B.A.9",
    section: "B",
    subsection: "Bölüm B.A: Stratejik Proje Hizalama ve Koordinasyon",
    storageLocation: "Kalite Kontrol Merkezi - Üretim Nihai İmzalar",
    requiredOutputs: "Üretim Sonuçlandırma Kontrol Listesi",
    kpiTimeDays: "Everyday Follow Up",
    approved: "Approved",
    desiredDateEnd: "2026-09-25",
    previousStepId: "B.A.6",
    task: "Kritik Kontrol Noktası Geçildi (Üretim Bitti)",
    approver: "Genel Müdür",
    requester: "Proje Yöneticisi",
    dateStart: "2026-09-12",
    actualDateEnd: "2026-09-24",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi"
  },
  {
    kpiMetric: "Ödeme İşlemi Time",
    section: "B",
    storageLocation: "Finans Klasörü - SWIFT Belgeleri",
    requiredOutputs: "Remaining Ödeme Kanıtı / SWIFT Belgesi",
    subsection: "Bölüm B.A: Stratejik Proje Hizalama ve Koordinasyon",
    kpiTimeDays: 2,
    desiredDateEnd: "2026-09-26",
    approved: "Approved",
    previousStepId: "B.A.9",
    id: "B.A.10",
    requester: "Proje Yöneticisi",
    dateStart: "2026-09-24",
    task: "Kalan Ödeme",
    approver: "Genel Müdür",
    actualDateEnd: "2026-09-26",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi"
  },
  {
    id: "B.A.11",
    approved: "Approved",
    desiredDateEnd: "2026-09-30",
    previousStepId: "B.A.6",
    section: "B",
    subsection: "Bölüm B.A: Stratejik Proje Hizalama ve Koordinasyon",
    storageLocation: "Lojistik Klasörü - Rezervasyonlar",
    requiredOutputs: "Onaylanmış Rezervasyon Referansı / BL Taslağı",
    kpiTimeDays: 6,
    kpiMetric: "Onaylanmış (Gemi/Tır) rezervasyon tarihi",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi",
    actualDateEnd: "2026-09-29",
    task: "Lojistik Rezervasyon Durumu",
    approver: "Genel Müdür",
    dateStart: "2026-09-24",
    requester: "Proje Yöneticisi"
  },
  {
    actualDateEnd: "2026-09-30",
    taskOwner: "Tedarik Yöneticisi",
    status: "Completed",
    approver: "Genel Müdür",
    task: "Çıkış Onayı (Tır/Gemi)",
    requester: "Proje Yöneticisi",
    dateStart: "2026-09-29",
    id: "B.A.12",
    kpiTimeDays: 2,
    section: "B",
    subsection: "Bölüm B.A: Stratejik Proje Hizalama ve Koordinasyon",
    requiredOutputs: "İhracat resmi belgeleri (Ticari Fatura, Çeki Listesi, Gümrük Beyannamesi)",
    storageLocation: "Lojistik Klasörü - İhracat Gümrük Belgeleri",
    previousStepId: "B.A.11",
    approved: "Approved",
    desiredDateEnd: "2026-10-01",
    kpiMetric: "İhracat Gümrük Belgelerinin İncelenmesi"
  },
  {
    id: "B.A.13",
    storageLocation: "Lojistik Klasörü - Gümrük Belgeleri",
    requiredOutputs: "Ticari Fatura, Çeki Listesi, Konşimento (BL), Menşe Şahadetnamesi ve konteyner takip numarasının onaylanması",
    subsection: "Bölüm B.A: Stratejik Proje Hizalama ve Koordinasyon",
    section: "B",
    kpiTimeDays: 2,
    desiredDateEnd: "2026-10-02",
    approved: "Approved",
    previousStepId: "B.A.12",
    kpiMetric: "İhracat Gümrük Belgelerinin İncelenmesi",
    actualDateEnd: "2026-10-02",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi",
    task: "Gerekli Belge Kontrol Listesi",
    approver: "Genel Müdür",
    requester: "Proje Yöneticisi",
    dateStart: "2026-09-30"
  },
  {
    kpiMetric: "Tüm belgelerin ithalat müşaviri ile paylaşılması",
    section: "B",
    storageLocation: "Lojistik Klasörü - Müşavir İletişimi",
    requiredOutputs: "Gümrük Müşaviri Katılım Onay E-postası",
    subsection: "Bölüm B.A: Stratejik Proje Hizalama ve Koordinasyon",
    kpiTimeDays: 2,
    desiredDateEnd: "2026-10-04",
    approved: "Approved",
    id: "B.A.14",
    requester: "Proje Yöneticisi",
    dateStart: "2026-10-02",
    task: "Gümrük Müşaviri Katılımı",
    approver: "Genel Müdür",
    actualDateEnd: "2026-10-04",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi"
  },
  {
    kpiMetric: "Zamanında Teslimat",
    kpiTimeDays: 2,
    section: "B",
    subsection: "Bölüm B.A: Stratejik Proje Hizalama ve Koordinasyon",
    requiredOutputs: "Nakliyeci tarafından gönderilen teslimat onay bildirimi",
    storageLocation: "Lojistik Klasörü - Teslimat Makbuzları",
    previousStepId: "B.A.13",
    desiredDateEnd: "2026-11-20",
    approved: "Pending",
    id: "B.A.15",
    requester: "Proje Yöneticisi",
    dateStart: "2026-10-04",
    approver: "Genel Müdür",
    task: "Sevkiyat Teslimat Onayı",
    actualDateEnd: "",
    taskOwner: "Tedarik Yöneticisi",
    status: "In Progress"
  },
  {
    approver: "Genel Müdür",
    task: "Güvenlik Stoğunun Belirlenmesi",
    dateStart: "2026-09-10",
    requester: "Proje Yöneticisi",
    actualDateEnd: "2026-09-16",
    taskOwner: "Tedarik Yöneticisi",
    status: "Completed",
    kpiMetric: "Stokta kaç günlük envanter tutmak istiyoruz. Güvenlik Stoğu Hesaplama doğruluğu (%95)",
    id: "B.B.1",
    kpiTimeDays: 6,
    section: "B",
    subsection: "Bölüm B.B: Envanter Planlama ve Tahmin",
    requiredOutputs: "Güvenlik Stoğu Hesaplama Excel Raporu",
    storageLocation: "Tedarik Zinciri - Ana Envanter Raporu",
    approved: "Approved",
    desiredDateEnd: "2026-09-16"
  },
  {
    id: "B.B.2",
    kpiTimeDays: 6,
    section: "B",
    subsection: "Bölüm B.B: Envanter Planlama ve Tahmin",
    requiredOutputs: "Aylık Satış Tahmin Raporu",
    storageLocation: "Satış - Tahminler Klasörü",
    approved: "Approved",
    desiredDateEnd: "2026-09-22",
    kpiMetric: "Tahminler tüm satış platformlarından toplanır (B2C + B2B tahmini) Tahmin Doğruluğu (En az %85)",
    actualDateEnd: "2026-09-21",
    taskOwner: "Tedarik Yöneticisi",
    status: "Completed",
    approver: "Genel Müdür",
    task: "Satış Tahminleri",
    requester: "Proje Yöneticisi",
    dateStart: "2026-09-16"
  },
  {
    actualDateEnd: "2026-09-29",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi",
    task: "Mevcut Fiziksel Stoğun Belirlenmesi",
    approver: "Genel Müdür",
    requester: "Proje Yöneticisi",
    dateStart: "2026-09-01",
    id: "B.B.3",
    section: "B",
    subsection: "Bölüm B.B: Envanter Planlama ve Tahmin",
    requiredOutputs: "Haftalık Fiziksel Stok Sayım Raporu",
    storageLocation: "Depo - Fiziksel Sayım Kayıtları",
    kpiTimeDays: "Every Month",
    approved: "Approved",
    desiredDateEnd: "2026-09-30",
    kpiMetric: "Depodaki fiili fiziksel miktar aylık olarak kontrol edilir"
  },
  {
    requester: "Proje Yöneticisi",
    dateStart: "2026-09-01",
    task: "Taahhüt Edilen Stoğun Belirlenmesi",
    approver: "Genel Müdür",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi",
    actualDateEnd: "2026-09-07",
    kpiMetric: "Onaylanmış B2C satışları veya onaylanmış B2B Satın Alma Siparişleri (PO'lar) için ayrılan miktar Doğruluğu (%100)",
    approved: "Approved",
    desiredDateEnd: "2026-09-07",
    subsection: "Bölüm B.B: Envanter Planlama ve Tahmin",
    requiredOutputs: "Açık Satış Siparişleri Listesi",
    storageLocation: "Satış - Aktif Siparişler",
    section: "B",
    kpiTimeDays: "Every Week",
    id: "B.B.4"
  },
  {
    kpiMetric: "Kural: fizikselStok - taahhütEdilenStok. Satışa fiilen hazır miktar.",
    id: "B.B.5",
    section: "B",
    subsection: "Bölüm B.B: Envanter Planlama ve Tahmin",
    storageLocation: "Tedarik Zinciri - Ana Envanter Raporu",
    requiredOutputs: "Kullanılabilir Stok Excel Dosyası",
    kpiTimeDays: "Every Week",
    desiredDateEnd: "2026-09-14",
    approved: "Approved",
    task: "Kullanılabilir Stok Raporu",
    approver: "Genel Müdür",
    requester: "Proje Yöneticisi",
    dateStart: "2026-09-07",
    actualDateEnd: "2026-09-13",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi"
  },
  {
    kpiMetric: "Yeniden sipariş noktası: (Tahmini Günlük Satış x Tedarikçi Teslim Süresi) + Güvenlik Stoğu Seviyesi",
    desiredDateEnd: "2026-09-16",
    approved: "Approved",
    kpiTimeDays: "As needed",
    section: "B",
    subsection: "Bölüm B.B: Envanter Planlama ve Tahmin",
    requiredOutputs: "Yeniden Sipariş Noktası Calculation Table",
    storageLocation: "Tedarik Zinciri - Yeniden Sipariş Limitleri",
    id: "B.B.6",
    requester: "Proje Yöneticisi",
    dateStart: "2026-09-15",
    approver: "Genel Müdür",
    task: "Yeniden Sipariş Noktası",
    taskOwner: "Tedarik Yöneticisi",
    status: "Completed",
    actualDateEnd: "2026-09-16"
  },
  {
    kpiMetric: "Amazon, Walmart ve Web Sitesini Kontrol Et",
    approved: "Approved",
    desiredDateEnd: "2026-10-02",
    section: "B",
    subsection: "Bölüm B.C: Çevrimiçi Sipariş Karşılama",
    requiredOutputs: "Günlük Kontrol Edilen Sipariş",
    storageLocation: "Sipariş Karşılama - Sipariş Portalı",
    kpiTimeDays: "Every Day",
    id: "B.C.1",
    dateStart: "2026-10-01",
    requester: "Proje Yöneticisi",
    task: "Siparişleri Kontrol Et",
    approver: "Genel Müdür",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi",
    actualDateEnd: "2026-10-01"
  },
  {
    approver: "Genel Müdür",
    task: "Check Kullanılabilir Stok Raporu",
    requester: "Proje Yöneticisi",
    dateStart: "2026-10-01",
    actualDateEnd: "2026-10-01",
    taskOwner: "Tedarik Yöneticisi",
    status: "Completed",
    kpiMetric: "Depomuzda sipariş edilen ürün SKU'sunun bulunduğundan emin olun",
    id: "B.C.2",
    kpiTimeDays: "When order is received",
    section: "B",
    subsection: "Bölüm B.C: Çevrimiçi Sipariş Karşılama",
    requiredOutputs: "Real-time Kullanılabilir Stok Raporu",
    storageLocation: "Sipariş Karşılama - Stok Doğrulama Kayıtları",
    desiredDateEnd: "2026-10-01",
    approved: "Approved"
  },
  {
    requester: "Proje Yöneticisi",
    dateStart: "2026-10-01",
    approver: "Genel Müdür",
    task: "Kargo Ücretlerini Kontrol Et",
    taskOwner: "Tedarik Yöneticisi",
    status: "Completed",
    actualDateEnd: "2026-10-01",
    kpiMetric: "Teslimat adresini ve depo adresini girip kargo maliyetlerini görün. Kargo Teklifi Karşılaştırması",
    approved: "Approved",
    desiredDateEnd: "2026-10-01",
    kpiTimeDays: "When order is received",
    section: "B",
    subsection: "Bölüm B.C: Çevrimiçi Sipariş Karşılama",
    storageLocation: "Sipariş Karşılama - Kargo Oranı Denetimleri",
    requiredOutputs: "Onaylanmış Nihai Kargo Teklifi",
    id: "B.C.3"
  },
  {
    kpiMetric: "Etiketi oluşturmak için müşterinin bilgilerini ve teslimat adresini girin. Etiket Oluşturma",
    desiredDateEnd: "2026-10-01",
    approved: "Approved",
    section: "B",
    subsection: "Bölüm B.C: Çevrimiçi Sipariş Karşılama",
    requiredOutputs: "Yazdırılmaya Hazır Kargo Etiketi",
    storageLocation: "Sipariş Karşılama - Etiket Arşivi",
    kpiTimeDays: "When order is received",
    id: "B.C.4",
    requester: "Proje Yöneticisi",
    dateStart: "2026-10-01",
    task: "Etiket Oluşturma",
    approver: "Genel Müdür",
    status: "Completed",
    taskOwner: "Tedarik Yöneticisi",
    actualDateEnd: "2026-10-01"
  },
  {
    kpiMetric: "Find the box in the warehouse and Etiketi Yapıştır to the box. Labelling Accuracy (100%)",
    id: "B.C.5",
    approved: "Approved",
    desiredDateEnd: "2026-10-01",
    kpiTimeDays: "When order is received",
    section: "B",
    subsection: "Bölüm B.C: Çevrimiçi Sipariş Karşılama",
    requiredOutputs: "Etiketlemenin tamamlanması",
    storageLocation: "Sipariş Karşılama - Üretim Kayıtları",
    approver: "Genel Müdür",
    task: "Etiketi Yapıştır",
    requester: "Proje Yöneticisi",
    dateStart: "2026-10-01",
    taskOwner: "Tedarik Yöneticisi",
    status: "Completed",
    actualDateEnd: "2026-10-01"
  },
  {
    dateStart: "2026-10-01",
    requester: "Proje Yöneticisi",
    approver: "Genel Müdür",
    task: "Takip Numarası",
    taskOwner: "Tedarik Yöneticisi",
    status: "Completed",
    actualDateEnd: "2026-10-01",
    kpiMetric: "Confirm shipping on Amazon/others and enter tracking number to the system. Takip Numarası Entry Time",
    desiredDateEnd: "2026-10-01",
    approved: "Approved",
    kpiTimeDays: "When order is received",
    section: "B",
    storageLocation: "Sipariş Karşılama - Takip Senkronizasyon Kayıtları",
    requiredOutputs: "Order-Specific Takip Numarası Record Log",
    subsection: "Bölüm B.C: Çevrimiçi Sipariş Karşılama",
    id: "B.C.6"
  },
  {
    kpiMetric: "Kargonun fotoğrafını çekin. Hem SKU hem de Kargo etiketinin görünür olduğundan emin olun. Fotoğrafı ortak klasöre yükleyin.",
    desiredDateEnd: "2026-10-01",
    approved: "Approved",
    kpiTimeDays: "When order is received",
    section: "B",
    subsection: "Bölüm B.C: Çevrimiçi Sipariş Karşılama",
    storageLocation: "Ortak Klasör - Kargo Kanıt Fotoğrafları",
    requiredOutputs: "Etiketli Paketin Fotoğraflı Kanıtı",
    id: "B.C.7",
    requester: "Proje Yöneticisi",
    dateStart: "2026-10-01",
    approver: "Genel Müdür",
    task: "Kanıt Olarak Fotoğraf Çekimi",
    taskOwner: "Tedarik Yöneticisi",
    status: "Completed",
    actualDateEnd: "2026-10-01"
  },
  {
    approver: "Genel Müdür",
    task: "Kullanılabilir Stok Raporu Adjustment",
    requester: "Proje Yöneticisi",
    dateStart: "2026-10-01",
    actualDateEnd: "2026-10-01",
    taskOwner: "Tedarik Yöneticisi",
    status: "Completed",
    kpiMetric: "Kullanılabilir stok raporunda gönderilen miktarı azaltın ve sipariş ayrıntılarını Excel'e girin (müşteri adı, sipariş kimliği dahil). Envanter Tutarsızlık Oranı",
    id: "B.C.8",
    kpiTimeDays: "When order is received",
    section: "B",
    storageLocation: "Tedarik Zinciri - Ana Envanter Raporu",
    requiredOutputs: "Gönderi Sonrası Stok Düzeltme Günlüğü",
    subsection: "Bölüm B.C: Çevrimiçi Sipariş Karşılama",
    desiredDateEnd: "2026-10-01",
    approved: "Approved"
  },
  {
    kpiMetric: "Amazon'da sipariş alıp gönderirseniz Walmart ve web sitesinde miktarı azaltın veya tam tersini yapın. Envanter için Platform Senkronizasyonu",
    id: "B.C.9",
    kpiTimeDays: "When order is received",
    section: "B",
    subsection: "Bölüm B.C: Çevrimiçi Sipariş Karşılama",
    requiredOutputs: "Platform Senkronizasyon Başarı Günlüğü",
    storageLocation: "Tedarik Zinciri - Çok Kanallı Senkronizasyon",
    desiredDateEnd: "2026-10-01",
    approved: "Approved",
    approver: "Genel Müdür",
    task: "Tüm Platformları Senkronize Et",
    requester: "Proje Yöneticisi",
    dateStart: "2026-10-01",
    actualDateEnd: "2026-10-01",
    taskOwner: "Tedarik Yöneticisi",
    status: "Completed"
  },
];

export const INITIAL_TARGET_SPECS: TargetSpecification[] = [
  {
    id: "spec-1",
    productName: "Premium Unlu Mamüllerlar - ComfortPro Büyük",
    category: "Ev ve Yaşam / Mobilya",
    dimensionsWidth: 95,
    dimensionsLength: 95,
    dimensionsHeight: 85,
    materialCover: "PU kaplamalı su geçirmez 600D Oxford kumaş",
    materialFilling: "Genişletilmiş Polistiren (EPS) orijinal boncuklar, yüksek yoğunluklu (16kg/m³)",
    colorOptions: ["Kömür Grisi", "Lacivert", "Zeytin Yeşili", "Sıcak Kum"],
    weightKg: 4.5,
    certifiedStandards: ["REACH Uyumlu", "BS5852 Alev Geciktirici", "OEKO-TEX Standart 100"],
    targetExwPrice: 15.50,
    targetFobPrice: 17.20,
    packagingDetails: "Çift katmanlı polietilen torbada vakumlu sıkıştırılmış paket, ağır hizmet tipi ana karton kutu (4 torba/karton)",
    notes: "Çift dikişli kenarlar ve çocuk kilidi olan ağır hizmet tipi emniyet fermuarları gerektirir.",
    lastUpdated: "2026-05-22"
  },
  {
    id: "spec-2",
    productName: "L-Şekilli Unlu Mamüller",
    category: "Lüks Dinlenme Alanı / Ayak Uzatma Pufu",
    dimensionsWidth: 120,
    dimensionsLength: 60,
    dimensionsHeight: 45,
    materialCover: "Teflon leke korumalı yüksek kalite Türk Kadife kumaşı",
    materialFilling: "Masif kayın ağacından iç iskeletli CertiPUR-US yüksek esneklikli sünger katmanları",
    colorOptions: ["Kraliyet Kadife Mavisi", "Zümrüt Yeşili", "Bordo Kırmızı"],
    weightKg: 12.0,
    certifiedStandards: ["REACH Uyumlu", "TSCA Başlık VI Sertifikalı"],
    targetExwPrice: 38.00,
    targetFobPrice: 42.50,
    packagingDetails: "Polifoam koruyucu köşeler, balonlu ambalaj sarımı, kalın oluklu mukavva kutu paketleme (1 adet/karton)",
    notes: "Zarif altın metalik kaplama ayaklar. Ayaklar, alt kısımdaki fermuarlı cep içinde demonte olarak gönderilmelidir.",
    lastUpdated: "2026-05-24"
  }
];

export const INITIAL_RFQS: RfqSubmission[] = [
  {
    id: "rfq-1",
    rfcCode: "RFQ-2026-BEANBAG",
    productName: "Unlu Mamüller Ürün Grubu",
    dateSent: "2026-05-29",
    targetQty: 1000,
    status: "Quote Received",
    suppliers: [
      {
        id: "rfq-s1",
        supplierName: "Anadolu Tekstil Ltd.",
        location: "Bursa, Türkiye",
        sampleCost: 50,
        leadTimeDays: 25,
        paymentTerms: "%30 Avans, %70 BL Karşılığı",
        initialQuoteExw: 15.20,
        hasNda: true,
        notes: "Rekabetçi fiyatlandırma sundu, tasarım ekibi çok hızlı geri dönüş yapıyor."
      },
      {
        id: "rfq-s2",
        supplierName: "Ege Ev Gereçleri A.Ş.",
        location: "İzmir, Türkiye",
        sampleCost: 75,
        leadTimeDays: 30,
        paymentTerms: "%50 Avans, %50 Teslimatta",
        initialQuoteExw: 16.50,
        hasNda: true,
        notes: "Teslimat süresi biraz daha uzun ama sertifikalı BS5852 standardı doğrulandı."
      },
      {
        id: "rfq-s3",
        supplierName: "Marmara Ev Eşyaları A.Ş.",
        location: "İstanbul, Türkiye",
        sampleCost: 0,
        leadTimeDays: 21,
        paymentTerms: "%100 CAD (Vesaik Mukabili Ödeme)",
        initialQuoteExw: 17.10,
        hasNda: false,
        notes: "En hızlı teslimat süresi ve ücretsiz numune, ancak birim maliyet en yüksek."
      }
    ]
  }
];

export const INITIAL_VALUE_CHAIN_COSTINGS: ValueChainCosting[] = [
  {
    id: "costing-1",
    productName: "Unlu Mamüller Ürün Grubu",
    quantity: 1000,
    exwUnitPrice: 15.20,
    domesticFreightTurkey: 850,
    exportCustomsTurkey: 450,
    oceanFreight: 3800,
    importCustomsDuty: 6.5,
    importerBrokerageAndClerance: 650,
    localWarehousingAndHandling: 1200,
    inlandDelivery: 1500,
    unexpectedBuffer: 500
  }
];

export const INITIAL_RFQ_MATRICES: RfqComparativeMatrix[] = [
  {
    id: "matrix-1",
    productName: "Unlu Mamüller Ürün Grubu",
    criteriaWeights: {
      unitPrice: 40,
      leadTime: 25,
      quality: 20,
      financialStability: 15
    },
    suppliers: [
      {
        name: "Anadolu Tekstil Ltd.",
        unitPriceExw: 15.20,
        leadTimeDays: 25,
        qualityScore: 9,
        paymentTermsScore: 8,
        commScore: 9,
        complianceScore: 9,
        responses: {
          // Cost and Sampe
          "fob_cost": "20.00",
          "sample_quality": "Referans Değerle Mükemmel Uyum",
          // Technical & Quality Data
          "traceability": "No",
          "quality_control": "Yes",
          "certificates": "Certi-pur, Oeko-Tex",
          "warranty_terms": "3 Yıl",
          "audit": "No",
          // Commercial Data
          "import_taxes": "15%",
          "logistic_unit_price": "19",
          "lead_time": "40'lık HQ Konteyner için 35 gün - limana kadar 3-4 gün",
          "payment_terms": "%30 peşin - %70 vesaik mukabili",
          "monthly_capacity": "3000 koltuk",
          // Company Information
          "average_revenue": "1 milyon USD'den az",
          "general_liability": "Yes",
          "number_of_factories": "Kayseri'de 1 adet",
          "vertical_manufacturing": "No",
          "retailer_experience": "No",
          "other_product_groups": "Bahçe Mobilyası, Yatak",
          "diff_points": "Sünger ve süngerli ürünlerdeki deneyimimiz.",
          "diff_point_1": "Rekabetçi fiyat politikamız.",
          "diff_point_2": "Müşterimizin talebine göre araştırma ve geliştirme yapabiliriz.",
          "diff_point_3": "Gelen taleplere hızlı yanıt verme yeteneğimiz ve yüksek üretim kapasitemiz.",
          "diff_point_4": "Firmamız, kendi hatamız olmasa dahi meydana gelen sorunların sorumluluğunu üstlenebilir.",
          "diff_point_5": ""
        },
        scores: {
          // Cost and Sampe
          "fob_cost": 90,
          "sample_quality": 100,
          // Technical & Quality Data
          "traceability": 0,
          "quality_control": 100,
          "certificates": 50,
          "warranty_terms": 75,
          "audit": 0,
          // Commercial Data
          "import_taxes": 50,
          "logistic_unit_price": 50,
          "lead_time": 50,
          "payment_terms": 50,
          "monthly_capacity": 50,
          // Company Information
          "average_revenue": 25,
          "general_liability": 100,
          "number_of_factories": 25,
          "vertical_manufacturing": 0,
          "retailer_experience": 0,
          "other_product_groups": 25,
          "diff_points": 60,
          "diff_point_1": 30,
          "diff_point_2": 30,
          "diff_point_3": 30,
          "diff_point_4": 70,
          "diff_point_5": 0
        }
      },
      {
        name: "Ege Ev Gereçleri A.Ş.",
        unitPriceExw: 16.50,
        leadTimeDays: 30,
        qualityScore: 10,
        paymentTermsScore: 7,
        commScore: 8,
        complianceScore: 10,
        responses: {
          "fob_cost": "22.50",
          "sample_quality": "Dikişlerde hafif kırışıklıklar",
          "traceability": "Yes",
          "quality_control": "Yes",
          "certificates": "ISO 9001, Oeko-Tex",
          "warranty_terms": "2 Yıl",
          "audit": "Yes",
          "import_taxes": "12%",
          "logistic_unit_price": "22",
          "lead_time": "30 gün",
          "payment_terms": "%50 peşin - %50 teslimatta",
          "monthly_capacity": "5000 adet",
          "average_revenue": "1-5 milyon USD",
          "general_liability": "Yes",
          "number_of_factories": "İzmir'de 2 adet",
          "vertical_manufacturing": "Yes",
          "retailer_experience": "Yes",
          "other_product_groups": "Tekstil, Minder",
          "diff_points": "Yüksek kaliteli dikiş yöntemleri",
          "diff_point_1": "Hızlı numune üretimi",
          "diff_point_2": "Çevre dostu malzemeler",
          "diff_point_3": "Yüksek müşteri memnuniyeti",
          "diff_point_4": "Güçlü yerel tedarik zinciri",
          "diff_point_5": ""
        },
        scores: {
          "fob_cost": 80,
          "sample_quality": 80,
          "traceability": 100,
          "quality_control": 100,
          "certificates": 80,
          "warranty_terms": 50,
          "audit": 100,
          "import_taxes": 70,
          "logistic_unit_price": 60,
          "lead_time": 80,
          "payment_terms": 60,
          "monthly_capacity": 80,
          "average_revenue": 50,
          "general_liability": 100,
          "number_of_factories": 50,
          "vertical_manufacturing": 100,
          "retailer_experience": 100,
          "other_product_groups": 50,
          "diff_points": 70,
          "diff_point_1": 60,
          "diff_point_2": 60,
          "diff_point_3": 60,
          "diff_point_4": 60,
          "diff_point_5": 0
        }
      },
      {
        name: "Marmara Ev Eşyaları A.Ş.",
        unitPriceExw: 17.10,
        leadTimeDays: 21,
        qualityScore: 8,
        paymentTermsScore: 9,
        commScore: 7,
        complianceScore: 8,
        responses: {
          "fob_cost": "24.00",
          "sample_quality": "Ortalama bitiş",
          "traceability": "No",
          "quality_control": "No",
          "certificates": "None",
          "warranty_terms": "1 Yıl",
          "audit": "No",
          "import_taxes": "18%",
          "logistic_unit_price": "25",
          "lead_time": "21 gün",
          "payment_terms": "%100 CAD (Vesaik Mukabili)",
          "monthly_capacity": "10000 adet",
          "average_revenue": "5 milyon USD'den fazla",
          "general_liability": "No",
          "number_of_factories": "İstanbul'da 3 adet",
          "vertical_manufacturing": "No",
          "retailer_experience": "No",
          "other_product_groups": "Çarşaf, Perde",
          "diff_points": "Yüksek kapasiteli üretim",
          "diff_point_1": "En hızlı nakliye rotaları",
          "diff_point_2": "Düşük maliyetli iş gücü",
          "diff_point_3": "Geniş depo alanı",
          "diff_point_4": "Çoklu platform entegrasyonu",
          "diff_point_5": ""
        },
        scores: {
          "fob_cost": 70,
          "sample_quality": 60,
          "traceability": 0,
          "quality_control": 0,
          "certificates": 0,
          "warranty_terms": 25,
          "audit": 0,
          "import_taxes": 40,
          "logistic_unit_price": 50,
          "lead_time": 90,
          "payment_terms": 80,
          "monthly_capacity": 100,
          "average_revenue": 80,
          "general_liability": 0,
          "number_of_factories": 80,
          "vertical_manufacturing": 0,
          "retailer_experience": 0,
          "other_product_groups": 40,
          "diff_points": 50,
          "diff_point_1": 50,
          "diff_point_2": 50,
          "diff_point_3": 50,
          "diff_point_4": 50,
          "diff_point_5": 0
        }
      }
    ]
  }
];

export const INITIAL_PRODUCT_RECIPES: ProductRecipe[] = [
  {
    id: "recipe-1",
    productName: "Unlu Mamüller Ürün Grubu",
    version: "v1.2",
    lastUpdated: "2026-07-15",
    materials: [
      {
        id: "mat-1",
        name: "Ağır Hizmet Tipi 600D Oxford Kumaş Kılıf",
        qtyRequired: 3.5,
        unit: "metre",
        unitCostUsd: 1.80,
        scrapRatePercent: 6,
        source: "Bursa Kumaş Fabrikası A.Ş."
      },
      {
        id: "mat-2",
        name: "EPS Orijinal Dolgu Boncukları (Yüksek Yoğunluklu)",
        qtyRequired: 220,
        unit: "litre",
        unitCostUsd: 0.022,
        scrapRatePercent: 2,
        source: "PetroTürk Kimya A.Ş."
      },
      {
        id: "mat-3",
        name: "İç Koruyucu Fileli Fermuarlı Torba",
        qtyRequired: 1,
        unit: "adet",
        unitCostUsd: 1.10,
        scrapRatePercent: 0,
        source: "Ankara Fermuar ve File Dünyası"
      },
      {
        id: "mat-4",
        name: "YKK Çift Güvenlik Kilitli Fermuar 90cm",
        qtyRequired: 1,
        unit: "adet",
        unitCostUsd: 0.75,
        scrapRatePercent: 1,
        source: "YKK Türkiye Satış Ofisi"
      },
      {
        id: "mat-5",
        name: "Naylon Dikiş İpliği (Ekstra Mukavemetli)",
        qtyRequired: 120,
        unit: "metre",
        unitCostUsd: 0.003,
        scrapRatePercent: 5,
        source: "İstanbul İplik Sanayi"
      },
      {
        id: "mat-6",
        name: "Trade2Turkey Dokuma Marka Etiketi",
        qtyRequired: 2,
        unit: "adet",
        unitCostUsd: 0.12,
        scrapRatePercent: 0,
        source: "Ege Matbaa ve Etiketçilik Ltd."
      }
    ],
    laborCostUsd: 2.20,
    packagingCostUsd: 0.85,
    overheadCostUsd: 0.40,
    targetExwCost: 15.50
  }
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: "sup-1",
    name: "Anadolu Tekstil Ltd.",
    city: "Bursa",
    country: "Turkey",
    mainCategory: "Tekstil, Dikiş ve Kumaş Mobilya",
    scores: {
      quality: 92,
      pricing: 95,
      delivery: 88,
      comm: 90
    } as any,
    capacityMonthly: 15000,
    employees: 185,
    verifiedStatus: "Gold",
    ndaSigned: true,
    sampleApproved: true,
    siteAuditCompleted: true,
    auditScorePercent: 94,
    evidenceFiles: [
      {
        name: "Signed_NDA_AnatolianTextiles.pdf",
        category: "NDA",
        dateAdded: "2026-06-16",
        size: "1.4 MB",
        downloadUrl: "#"
      },
      {
        name: "Factory_Audit_Bursa_Anatolian_v2.pdf",
        category: "Audit Report",
        dateAdded: "2026-08-01",
        size: "4.2 MB",
        downloadUrl: "#"
      },
      {
        name: "REACH_Compliance_Certificate_Oxford600D.pdf",
        category: "Certificate",
        dateAdded: "2026-05-20",
        size: "2.1 MB",
        downloadUrl: "#"
      },
      {
        name: "BS5852_Fire_Safety_Test_Report.pdf",
        category: "Certificate",
        dateAdded: "2026-05-24",
        size: "1.8 MB",
        downloadUrl: "#"
      }
    ]
  },
  {
    id: "sup-2",
    name: "Ege Ev Gereçleri A.Ş.",
    city: "Izmir",
    country: "Turkey",
    mainCategory: "Mobilya ve Dolgulu Torba Montajı",
    scores: {
      quality: 95,
      pricing: 88,
      delivery: 85,
      comm: 86
    } as any,
    capacityMonthly: 8000,
    employees: 95,
    verifiedStatus: "Verified",
    ndaSigned: true,
    sampleApproved: true,
    siteAuditCompleted: true,
    auditScorePercent: 88,
    evidenceFiles: [
      {
        name: "NDA_Mutilateral_EgeLiving.pdf",
        category: "NDA",
        dateAdded: "2026-06-17",
        size: "950 KB",
        downloadUrl: "#"
      },
      {
        name: "OEKO-TEX_Standard_100_Certificate.pdf",
        category: "Certificate",
        dateAdded: "2026-05-25",
        size: "3.2 MB",
        downloadUrl: "#"
      }
    ]
  },
  {
    id: "sup-3",
    name: "Marmara Ev Eşyaları A.Ş.",
    city: "Istanbul",
    country: "Turkey",
    mainCategory: "Sentetik Dolgu Ürünleri ve Paketleme",
    scores: {
      quality: 82,
      pricing: 85,
      delivery: 92,
      comm: 75
    } as any,
    capacityMonthly: 25000,
    employees: 350,
    verifiedStatus: "Pending",
    ndaSigned: false,
    sampleApproved: false,
    siteAuditCompleted: false,
    auditScorePercent: 0,
    evidenceFiles: []
  }
];

export const INITIAL_SHIPMENTS: ShipmentMilestone[] = [
  {
    id: "ship-1",
    shipmentNumber: "T2T-SHP-1002",
    productName: "Unlu Mamüller Ürün Grubu",
    supplierName: "Anadolu Tekstil Ltd.",
    containerId: "TGHU6638490 (40'lık HC Konteyner)",
    vesselName: "MSC Istanbul V-264E",
    originPort: "Port of Ambarli, İstanbul, Türkiye (TR_AMB)",
    destinationPort: "Rotterdam Limanı, Hollanda (NL_RTM)",
    status: "Transit",
    latitude: 38.21,
    longitude: 15.35, // Near Messina Strait, Med Sea
    departureDate: "2026-09-30",
    estimatedArrival: "2026-11-20",
    currentMilestoneIndex: 5,
    milestones: [
      { title: "Hammadde Tedariği", date: "2026-09-10", completed: true, status: "Tamamlandı", description: "Tüm kumaş ve dolgu ham maddeleri fabrikaya ulaştı." },
      { title: "Ambalaj Tedariği", date: "2026-09-15", completed: true, status: "Tamamlandı", description: "Koli ve etiket ambalaj malzemeleri basıldı ve doğrulandı." },
      { title: "Üretim Aşaması", date: "2026-09-24", completed: true, status: "Tamamlandı", description: "1.000 adetin tamamı dolduruldu, kalite kontrolü yapıldı ve vakumlu paketlendi." },
      { title: "Rezervasyon & Yükleme", date: "2026-09-29", completed: true, status: "Tamamlandı", description: "40ft HC konteyner rezerve edildi, Ankara merkezinde dolduruldu, mühür doğrulandı." },
      { title: "Türk Gümrük İşlemleri", date: "2026-09-30", completed: true, status: "Tamamlandı", description: "İhracat beyannamesi İstanbul Gümrük Müşaviri tarafından onaylandı." },
      { title: "Türk Limanından Çıkış", date: "2026-09-30", completed: true, status: "Tamamlandı", description: "Gemi planlanan saatte çıkış terminalinden ayrıldı." },
      { title: "İthalat Ülkesi Limanına Varış", date: "2026-11-15", completed: false, status: "Devam Ediyor", description: "Gemi ithalat ülkesinin limanına yanaştı ve tahliye planlaması başlatıldı." },
      { title: "Gümrük İşlemleri", date: "2026-11-18", completed: false, status: "Bekliyor", description: "İthalat gümrük beyannamesi ve millileştirme işlemleri onaylandı." },
      { title: "Depoya Teslim", date: "2026-11-20", completed: false, status: "Bekliyor", description: "İç nakliye, fiziksel muayene, envanter senkronizasyonu." }
    ],
    cargoPhotos: [
      {
        id: "photo-1",
        title: "Vakumlu Paketleme Kontrolü",
        url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop",
        timestamp: "2026-09-24 14:32"
      },
      {
        id: "photo-2",
        title: "40'lık HC Konteynere Yükleme",
        url: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?q=80&w=600&auto=format&fit=crop",
        timestamp: "2026-09-29 09:15"
      },
      {
        id: "photo-3",
        title: "MSC Istanbul Gemisine Yükleme",
        url: "https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?q=80&w=600&auto=format&fit=crop",
        timestamp: "2026-09-30 17:40"
      }
    ]
  }
];

export const INITIAL_INVENTORY_ITEMS: InventoryItem[] = [
  {
    id: "inv-1",
    sku: "T2T-CPRO-CGRY",
    name: "ComfortPro Bean Bag - Kömür Grisi",
    safetyStockDays: 14,
    forecastDailySales: 15,
    physicalStock: 280,
    committedStock: 120,
    leadTimeDays: 25
  },
  {
    id: "inv-2",
    sku: "T2T-CPRO-NBLU",
    name: "ComfortPro Bean Bag - Lacivert",
    safetyStockDays: 14,
    forecastDailySales: 18,
    physicalStock: 350,
    committedStock: 140,
    leadTimeDays: 25
  },
  {
    id: "inv-3",
    sku: "T2T-CPRO-SND",
    name: "ComfortPro Bean Bag - Sıcak Kum",
    safetyStockDays: 14,
    forecastDailySales: 10,
    physicalStock: 80, // Low stock, reorder soon!
    committedStock: 45,
    leadTimeDays: 25
  }
];

export const INITIAL_FULFILLMENT_ORDERS: FulfillmentOrder[] = [
  {
    id: "ord-1",
    platform: "Amazon",
    orderId: "AMZ-10029393-2026",
    sku: "T2T-CPRO-CGRY",
    customerName: "Elspeth Vance",
    shippingAddress: "244 Baker St, London, NW1 5RT, United Kingdom",
    shippingRates: [
      { carrier: "DHL Kargo", rate: 12.50, duration: "2 Days" },
      { carrier: "DPD Standart", rate: 8.90, duration: "3-4 Days" },
      { carrier: "Royal Mail Takip Edilebilir", rate: 7.20, duration: "4-5 Days" }
    ],
    selectedRate: { carrier: "DPD Standart", rate: 8.90, duration: "3-4 Days" },
    shippingLabelUrl: "https://example.com/labels/dpd-10292.pdf",
    trackingNumber: "DPD-948301938592-UK",
    status: "Senkronize Edildi",
    cargoProofPhotoUrl: "https://images.unsplash.com/photo-1512418491533-31f0cf871861?q=80&w=400&auto=format&fit=crop",
    dateReceived: "2026-06-03"
  },
  {
    id: "ord-2",
    platform: "Shopify Web Sitesi",
    orderId: "WEB-9923",
    sku: "T2T-CPRO-SND",
    customerName: "Guance Thompson",
    shippingAddress: "72 Kaiserswerther Str, Dusseldorf, 40476, Germany",
    shippingRates: [
      { carrier: "DHL Hızlı Kargo", rate: 24.00, duration: "1 Day" },
      { carrier: "Hermes Standart", rate: 9.50, duration: "3-5 Days" },
      { carrier: "UPS Standart", rate: 11.20, duration: "2-3 Days" }
    ],
    status: "Kontrol Bekliyor",
    dateReceived: "2026-06-03"
  }
];
