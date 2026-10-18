// Legacy labels are read aliases only. All new writes use stable keys.
const alias = <K extends string>(groups: Record<K, readonly string[]>) => {
  const map = new Map<string,K>();
  for (const [key, values] of Object.entries(groups) as [K, readonly string[]][]) for (const value of [key, ...values]) map.set(value,key);
  return (value: unknown): K | null => typeof value === 'string' ? map.get(value.trim()) ?? null : null;
};
export const userStatusKey = alias({active:['Aktif','Active'],suspended:['Askıya Alındı','Suspended'],inactivity_warning:['Kritik Eylemsizlik Uyarısı'],pending_auth:['Pending authentication']});
export const leadStatusKey = alias({in_progress:['Devam Ediyor','In Progress'],closed_lost:['Olumsuz Sonuçlandı','Unsuccessful'],closed_won:['Olumlu Sonuçlandı','Successful'],initial_contact:['İlk Temas','Initial Contact'],quotation:['Teklif Aşaması','Proposal Stage'],qualified:['Nitelikli Talep','Qualified Request'],negotiating:['Görüşülüyor','In Discussion'],rejected:['Reddedildi','Rejected']});
export const companyTypeKey = alias({distributor:['Distribütör','Distributor'],importer:['İthalatçı','Importer'],wholesaler:['Toptancı','Wholesaler'],retail_chain:['Perakende Zinciri','Retail Chain'],ecommerce_seller:['E-Ticaret Satıcısı','E-commerce Seller']});
export const urgencyKey = alias({immediate:['Hemen','Immediately'],within_1_3_months:['1-3 Ay İçinde','Within 1-3 Months'],within_1_year:['1 yıl','1 Year'],over_1_year:['1 yıldan uzun','Over 1 Year']});
