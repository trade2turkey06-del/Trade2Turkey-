export const DIRECTORY_TEXT_FIELDS = ['location','address','foundedYear','employees','description','products','capacity','certificates','markets','notes','companyType','productSummary','locationNote','technicalSpecs','packaging','missingCertificates'] as const;
export type DirectoryTextField = typeof DIRECTORY_TEXT_FIELDS[number];
export interface DirectoryEnglish extends Partial<Record<DirectoryTextField,string>> { name?: string; contactTitles?: Record<string,string> }
export interface Sector { id:string; name:string; archived?:boolean; translations?: {en?: {name?:string}} }
export interface DirectoryContact {id:string; name:string; title:string; phone:string; email:string}
export interface DirectoryCompany {
  id:string; sectorId:string; name:string; website:string; catalogUrl:string; description:string; foundedYear:string; employees:string;
  location:string; address:string; phone:string; email:string; products:string; certificates:string; capacity:string; markets:string; notes:string; contacts:DirectoryContact[];
  productSummary?:string; companyType?:string; locationNote?:string; technicalSpecs?:string; packaging?:string; missingCertificates?:string;
  tags?:string[]; isDemo?:boolean; translations?:{en?:DirectoryEnglish};
}
export const SHARED_DIRECTORY_FIELDS = ['name','website','catalogUrl','phone','email'] as const;
export function translatedValue(tr:string|undefined,en:string|undefined,lang:'tr'|'en') {
  const source=tr??'',target=en??'';
  return {text:lang==='en'&&target.trim()?target:source,missing:lang==='en'&&!!source.trim()&&!target.trim()};
}
export const companyValue=(company:DirectoryCompany,field:DirectoryTextField,lang:'tr'|'en')=>translatedValue(company[field],company.translations?.en?.[field],lang);
export const sectorValue=(sector:Sector,lang:'tr'|'en')=>translatedValue(sector.name,sector.translations?.en?.name,lang);
export const contactTitle=(company:DirectoryCompany,person:DirectoryContact,lang:'tr'|'en')=>translatedValue(person.title,company.translations?.en?.contactTitles?.[person.id],lang);
export function missingTranslations(company:DirectoryCompany) {
  return [...DIRECTORY_TEXT_FIELDS.filter(field=>companyValue(company,field,'en').missing),...company.contacts.filter(person=>contactTitle(company,person,'en').missing).map(person=>`contacts.${person.id}.title`)];
}
// Only the translation container is changed. Shared identities and TR source text
// stay byte-for-byte intact; unknown metadata in the container is preserved.
export function withEnglish(company:DirectoryCompany,field:DirectoryTextField,value:string):DirectoryCompany {
  return {...company,translations:{...company.translations,en:{...company.translations?.en,[field]:value}}};
}
export function withContactEnglish(company:DirectoryCompany,id:string,value:string):DirectoryCompany {
  return {...company,translations:{...company.translations,en:{...company.translations?.en,contactTitles:{...company.translations?.en?.contactTitles,[id]:value}}}};
}
