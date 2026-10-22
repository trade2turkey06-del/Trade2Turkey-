import input from './textile-prospects.json';
import type {RecordDoc, Change} from './plan';
const normal=(s:string)=>s.toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/\p{M}/gu,'').replace(/ı/g,'i').replace(/[^a-z0-9]/g,'');
const host=(s:string)=>{try{return new URL(s.includes('://')?s:`https://${s}`).hostname.toLowerCase().replace(/^www\./,'');}catch{return '';}};
const blank=(v:any)=>v==null||(typeof v==='string'&&!v.trim());
export function plan(records:RecordDoc[],_review:any[]=[]){
 const docs=structuredClone(records), changes=new Map<string,Change>(), skipped:string[]=[];
 function touch(d:RecordDoc,key:string){let c=changes.get(d.path);if(!c){c={...d,fields:[],create:!records.some(r=>r.path===d.path)};changes.set(d.path,c);}if(!c.fields.includes(key))c.fields.push(key);}
 function fill(d:RecordDoc,key:string,value:any){if(blank(value))return;const parts=key.split('.');let obj=d.data;for(const part of parts.slice(0,-1))obj=obj[part]??={};const k=parts.at(-1)!;if(blank(obj[k])){obj[k]=value;touch(d,key);}}
 function create(path:string,data:any){if(docs.some(d=>d.path===path))throw Error(`ID collision: ${path}`);const d={path,data};docs.push(d);for(const k of Object.keys(data))touch(d,k);return d;}
 const sectorIds=new Map<string,string>();
 const renamed=docs.filter(d=>d.path.startsWith('sectors/')&&[d.data.name,d.data.translations?.en?.name].some(n=>n&&['Havlu','Towels & Home Textile','Havlu ve Banyo Tekstili','Towels & Bath Textiles'].some(alias=>normal(n)===normal(alias))));
 if(renamed.length!==1)throw Error('Expected one existing towels sector');
 const towel=renamed[0];
 for(const [key,value] of [['name','Havlu ve Banyo Tekstili'],['translations.en.name','Towels & Bath Textiles']]){if(key==='name'){if(towel.data.name!==value){towel.data.name=value;touch(towel,key);}}else{if(towel.data.translations?.en?.name!==value){towel.data.translations??={};towel.data.translations.en??={};towel.data.translations.en.name=value;touch(towel,key);}}}
 for(const [id,name] of input.sectors){const aliases=id==='hazir-giyim'?['Apparel','Hazır Giyim']:[name];const matches=docs.filter(d=>d.path.startsWith('sectors/')&&[d.data.name,d.data.translations?.en?.name].some(n=>n&&aliases.some(alias=>normal(n)===normal(alias))));if(matches.length>1)throw Error(`Ambiguous sector: ${name}`);if(id==='hazir-giyim'&&!matches.length)throw Error('Existing Apparel sector missing');const d=id==='havlu'?towel:matches[0]??create(`sectors/${id}`,{name,archived:false,translations:{en:{name}}});fill(d,'translations.en.name',name);sectorIds.set(id,d.path.split('/')[1]);}
 const alasev=docs.filter(d=>d.path.startsWith('directoryCompanies/')&&(['Alas Ev Tekstil','Alasev Tekstil','Alas Ev Tekstil (Alasev)'].some(n=>normal(n)===normal(d.data.name||''))||host(d.data.website||'')==='alasevtekstil.com'));
 if(alasev.length!==1)throw Error('Expected one existing Alasev');
 const moved:string[]=[];const storageId=sectorIds.get('home-storage-organizers');if(!storageId)throw Error('Storage sector missing');
 if(alasev[0].data.sectorId!==storageId){alasev[0].data.sectorId=storageId;touch(alasev[0],'sectorId');moved.push(alasev[0].data.name);}
 for(const s of input.suppliers){const matches=docs.filter(d=>d.path.startsWith('directoryCompanies/')&&(normal(d.data.name||'')===normal(s.name)||(!!s.website&&host(d.data.website||'')===host(s.website))));if(matches.length>1)throw Error(`Ambiguous company: ${s.name}`);let d=matches[0];if(d)skipped.push(s.name);else d=create(`directoryCompanies/${normal(s.name)}`,{sectorId:sectorIds.get(s.sectorId),name:s.name,website:'',catalogUrl:'',description:'',foundedYear:'',employees:'',location:'',address:'',phone:'',email:'',products:'',certificates:'',capacity:'',markets:'',notes:'',contacts:[]});
 for(const key of ['website','location','products','notes'] as const)fill(d,key,s[key]);
 fill(d,'translations.en.name',d.data.name);
 for(const key of ['location','products','notes'] as const)if(d.data[key]===s[key])fill(d,`translations.en.${key}`,s[key]);
 if(d.data.tags!=null&&!Array.isArray(d.data.tags))throw Error(`Invalid tags: ${d.path}`);
 for(const tag of s.tags)if(!d.data.tags?.includes(tag)){d.data.tags=[...(d.data.tags||[]),tag];touch(d,'tags');}
 }
 return {changes:[...changes.values()],records:docs,unverified:input.suppliers.filter(s=>!s.website).map(s=>s.name),skipped,moved};
}
