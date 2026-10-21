import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { reserve } from "../src/domain/operations";
import { createSpec } from "../src/domain/productSpec";
import { createCogsSheet, reconcileCogs, reconcileMatrix, syncMatrixFromCogs } from "../src/domain/cogsBreakdown";
import { createBomSheet, reconcileBom } from "../src/domain/bomComparison";
import { createMatrix } from "../src/domain/rfqMatrix";
import { en } from "../src/i18n/en";

let env: RulesTestEnvironment;
before(async()=>{env=await initializeTestEnvironment({projectId:"demo-t2t-security",firestore:{host:"127.0.0.1",port:8085,rules:await fs.readFile("firestore.rules","utf8")}});});
after(async()=>{await env?.cleanup();});
beforeEach(async()=>{
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context=>{
    const db=context.firestore();
    for(const [id,role,projectId] of [["admin","admin","a"],["approver","admin","a"],["client","client","a"],["other","client","b"],["freelancer","freelancer","a"]]) await setDoc(doc(db,"users",id),{id,email:`${id}@test.invalid`,role,projectId,assignedProjects:[projectId],status:"active",companyName:id});
    for(const id of ["a","b"]) await setDoc(doc(db,"projects",id),{id,name:id});
    await setDoc(doc(db,"projects/a/products/sku"),{id:"sku",projectId:"a",sku:"sku",name:"Ürün",unit:"adet",safetyStock:1});
    await setDoc(doc(db,"projects/a/stock/sku"),{projectId:"a",productId:"sku",physical:10,reserved:0,safetyStock:1});
  });
});
const dbFor=(uid:string)=>env.authenticatedContext(uid,{email:`${uid}@test.invalid`,admin:["admin","approver"].includes(uid)}).firestore();
test("anonim erişim, kendi admin profilini oluşturma ve rol yükseltme reddedilir",async()=>{
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),"projects/a")));
  await assertFails(setDoc(doc(dbFor("attacker"),"users/attacker"),{id:"attacker",role:"admin",email:"attacker@test.invalid",projectId:"a"}));
  await assertFails(updateDoc(doc(dbFor("client"),"users/client"),{role:"admin"}));
  await assertFails(updateDoc(doc(dbFor("client"),"users/client"),{projectId:"b"}));
});
test("müşteri yalnızca kendi projesini ve profilini okuyabilir",async()=>{
  await assertSucceeds(getDoc(doc(dbFor("client"),"projects/a")));
  await assertFails(getDoc(doc(dbFor("client"),"projects/b")));
  await assertFails(getDocs(collection(dbFor("client"),"users")));
  await assertSucceeds(updateDoc(doc(dbFor("client"),"users/client"),{contactPerson:"Test"}));
});
test("admin davet profili oluşturabilir, müşteri oluşturamaz",async()=>{
  const data={id:"invited",email:"invited@test.invalid",role:"client",projectId:"a",companyName:"Test",assignedProjects:["a"]};
  await assertSucceeds(setDoc(doc(dbFor("admin"),"users/invited"),data));
  await assertFails(setDoc(doc(dbFor("client"),"users/second"),{...data,id:"second"}));
});
test("askıya alınan hesap proje verilerine erişemez",async()=>{
  await updateDoc(doc(dbFor("admin"),"users/client"),{status:"suspended"});
  await assertFails(getDoc(doc(dbFor("client"),"projects/a/stock/sku")));
});
test("eski bir profilin admin alanı tek başına yönetici yetkisi sağlamaz",async()=>{
  await env.withSecurityRulesDisabled(async context=>setDoc(doc(context.firestore(),"users/profile-only-admin"),{id:"profile-only-admin",email:"test@test.invalid",role:"admin",projectId:"a",status:"active"}));
  await assertFails(getDoc(doc(dbFor("profile-only-admin"),"projects/b")));
  await assertFails(getDocs(collection(dbFor("profile-only-admin"),"users")));
});
test("stok güncellemesi müşteriye kapalı; negatif stok ve aşırı rezervasyon reddedilir",async()=>{
  await assertFails(updateDoc(doc(dbFor("client"),"projects/a/stock/sku"),{physical:100}));
  await assertFails(updateDoc(doc(dbFor("admin"),"projects/a/stock/sku"),{physical:-1}));
  await assertFails(updateDoc(doc(dbFor("admin"),"projects/a/stock/sku"),{reserved:11}));
});
test("teklif şartları PO taslağına aynen geçmeli ve sözleşme onaysız sipariş doğrulanamaz",async()=>{
  const database=dbFor("admin");
  await setDoc(doc(database,"projects/a/vendors/vendor"),{id:"vendor",projectId:"a",name:"Firma",email:"test@test.invalid",location:"İstanbul"});
  const quote={id:"quote",projectId:"a",productId:"sku",supplierId:"vendor",quantity:10,unitPrice:5,currency:"USD",leadTimeDays:3,incoterm:"EXW",paymentTerms:"Teslimde",selected:false};
  await assertSucceeds(setDoc(doc(database,"projects/a/quotes/quote"),quote));
  const po={...quote,quoteId:"quote",receivedQty:0,status:"draft"};delete (po as any).selected;
  await assertFails(setDoc(doc(database,"projects/a/purchaseOrders/quote"),{...po,currency:"EUR"}));
  await assertSucceeds(setDoc(doc(database,"projects/a/purchaseOrders/quote"),po));
  await assertFails(updateDoc(doc(database,"projects/a/purchaseOrders/quote"),{status:"ordered",poDocumentUrl:"https://drive.google.com/po",confirmedBy:"admin",confirmedAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(database,"projects/a/purchaseOrders/quote"),{status:"received",receivedQty:10}));
});
test("eşzamanlı iki sipariş aynı stoğu iki kere ayıramaz",async()=>{
  const database=dbFor("admin");
  const make=async(id:string)=>{
    const order={id,projectId:"a",productId:"sku",customer:"Test",platform:"B2B",quantity:6,reservedQty:0,shippedQty:0,cancelledQty:0,status:"draft" as const};
    await setDoc(doc(database,"projects/a/salesOrders",id),order);
    return runTransaction(database,async tx=>{
      const stockRef=doc(database,"projects/a/stock/sku"), orderRef=doc(database,"projects/a/salesOrders",id);
      const stock=await tx.get(stockRef), record=await tx.get(orderRef);
      const next=reserve(stock.data() as any,record.data() as any);
      tx.update(stockRef,{reserved:next.stock.reserved});tx.update(orderRef,{status:next.order.status,reservedQty:next.order.reservedQty});
    });
  };
  const result=await Promise.allSettled([make("one"),make("two")]);assert.equal(result.filter(item=>item.status==="fulfilled").length,1);assert.equal((await getDoc(doc(database,"projects/a/stock/sku"))).data()?.reserved,6);
});
test("SOP belgesiz tamamlanamaz ve kendi işlemi onaylanamaz",async()=>{
  const database=dbFor("admin"), taskRef=doc(database,"sopSteps/a_sourcing-A.A.1");
  const task={id:"sourcing-A.A.1",projectId:"a",stepId:"A.A.1",workflow:"sourcing",workflowStatus:"completed",assigneeUid:"admin",approverUid:"approver",completedBy:"admin",dueDate:"2026-10-20",notes:"",approval:"pending",status:"Completed",evidenceName:"NDA",evidenceUrl:"",lastEventId:"event"};
  const batch=writeBatch(database);batch.set(taskRef,task);batch.set(doc(database,"projects/a/events/event"),{projectId:"a",actorUid:"admin",at:serverTimestamp(),action:"workflow_save",entityId:"A.A.1",detail:"test"});await assertFails(batch.commit());
  const valid=writeBatch(database);valid.set(taskRef,{...task,evidenceUrl:"https://drive.google.com/file/test"});valid.set(doc(database,"projects/a/events/event"),{projectId:"a",actorUid:"admin",at:serverTimestamp(),action:"workflow_save",entityId:"A.A.1",detail:"test"});await assertSucceeds(valid.commit());
  const approve=writeBatch(database);approve.update(taskRef,{approval:"approved",decidedBy:"admin",updatedAt:serverTimestamp(),lastEventId:"self"});approve.set(doc(database,"projects/a/events/self"),{projectId:"a",actorUid:"admin",at:serverTimestamp(),action:"workflow_approve",entityId:"A.A.1",detail:"self"});await assertFails(approve.commit());
  const approverDb=dbFor("approver"), approved=writeBatch(approverDb);approved.update(doc(approverDb,taskRef.path),{approval:"approved",decidedBy:"approver",updatedAt:serverTimestamp(),lastEventId:"approved"});approved.set(doc(approverDb,"projects/a/events/approved"),{projectId:"a",actorUid:"approver",at:serverTimestamp(),action:"workflow_approve",entityId:"A.A.1",detail:"approved"});await assertSucceeds(approved.commit());
});
test("işlem geçmişi sonradan değiştirilemez",async()=>{
  const database=dbFor("admin"),ref=doc(database,"projects/a/events/audit");
  await assertSucceeds(setDoc(ref,{projectId:"a",actorUid:"admin",at:serverTimestamp(),action:"test",entityId:"sku",detail:"record"}));
  await assertFails(updateDoc(ref,{detail:"changed"}));
});
test("SOP ön koşulu ve belge kimliği atlanamaz; yapan kişi sahteleştirilemez",async()=>{
  const database=dbFor("admin");
  const make=(path:string,stepId:string,completedBy="admin")=>{
    const batch=writeBatch(database),eventId=`event-${stepId}-${completedBy}`;
    batch.set(doc(database,path),{id:`sourcing-${stepId}`,projectId:"a",stepId,workflow:"sourcing",workflowStatus:"completed",assigneeUid:"admin",approverUid:"approver",completedBy,dueDate:"2026-10-20",approval:"pending",evidenceName:"Belge",evidenceUrl:"https://drive.google.com/test",lastEventId:eventId});
    batch.set(doc(database,"projects/a/events",eventId),{projectId:"a",actorUid:"admin",at:serverTimestamp(),action:"workflow_save",entityId:stepId,detail:"test"});return batch.commit();
  };
  await assertFails(make("sopSteps/a_sourcing-A.A.2","A.A.2"));
  await assertFails(make("sopSteps/a_sourcing-A.A.2","A.A.1"));
  await assertFails(make("sopSteps/a_sourcing-A.A.1","A.A.1","someone-else"));
});
test("yedekten dönüş aynı projede eksik kayıt ekleyebilir; mevcut kayıt değişmez",async()=>{
  const database=dbFor("admin"),ref=doc(database,"projects/a/products/restored"),data={id:"restored",projectId:"a",sku:"restored",name:"Yedek ürün",unit:"adet",safetyStock:0,recoveredAt:serverTimestamp(),recoveredBy:"admin"};
  await runTransaction(database,async tx=>{const snapshot=await tx.get(ref);if(!snapshot.exists())tx.set(ref,data);});
  await runTransaction(database,async tx=>{const snapshot=await tx.get(ref);if(!snapshot.exists())tx.set(ref,{...data,name:"Değişmemeli"});});
  assert.equal((await getDoc(ref)).data()?.name,"Yedek ürün");
  await assertFails(setDoc(doc(dbFor("client"),"projects/a/products/injected"),{...data,id:"injected",recoveredBy:"client"}));
});
test("onaydan iade edilen adım ve bağlı iş aynı işlemde tekrar açılabilir",async()=>{
  await env.withSecurityRulesDisabled(async context=>{const database=context.firestore();for(const id of ["A.A.1","A.A.2"])await setDoc(doc(database,`sopSteps/a_sourcing-${id}`),{id:`sourcing-${id}`,projectId:"a",stepId:id,workflow:"sourcing",workflowStatus:"completed",approval:"approved",assigneeUid:"admin",approverUid:"approver",completedBy:"admin",dueDate:"2026-10-20",evidenceName:"Belge",evidenceUrl:"https://drive.google.com/test"});});
  const database=dbFor("approver"),batch=writeBatch(database);
  batch.update(doc(database,"sopSteps/a_sourcing-A.A.1"),{approval:"rejected",workflowStatus:"incomplete",status:"Pending",rejectionReason:"Belge revizyonu gerekli",decidedBy:"approver",updatedAt:serverTimestamp(),lastEventId:"return"});
  batch.update(doc(database,"sopSteps/a_sourcing-A.A.2"),{approval:"none",workflowStatus:"incomplete",status:"Pending",rejectionReason:"A.A.1: Belge revizyonu gerekli",returnedFrom:"A.A.1",updatedAt:serverTimestamp(),lastEventId:"return"});
  batch.set(doc(database,"projects/a/events/return"),{projectId:"a",actorUid:"approver",at:serverTimestamp(),action:"workflow_reject",entityId:"A.A.1",detail:"Belge revizyonu gerekli"});await assertSucceeds(batch.commit());
  assert.equal((await getDoc(doc(database,"sopSteps/a_sourcing-A.A.2"))).data()?.approval,"none");
});
test("freelancer yalnızca atanmış müşteri adayına erişir; proje değiştirilemez",async()=>{
  const database=dbFor("freelancer"),ref=doc(database,"leads/lead");
  await assertSucceeds(setDoc(ref,{projectId:"a",companyName:"Firma",assignedTo:"freelancer",userId:"freelancer"}));
  await assertFails(updateDoc(ref,{projectId:"b"}));
  await assertFails(getDoc(doc(dbFor("client"),ref.path)));
  await assertSucceeds(getDocs(query(collection(database,"leads"),where("assignedTo","==","freelancer"),where("projectId","==","a"))));
});
test("sektör rehberi yalnızca admin içindir; sektör silinemez",async()=>{
  const company={sectorId:"towel",name:"MTC Linen",contacts:[{id:"c",name:"Kişi",title:"",phone:"",email:""}]};
  await assertSucceeds(setDoc(doc(dbFor("admin"),"sectors/towel"),{name:"Towel",archived:false}));
  await assertSucceeds(setDoc(doc(dbFor("admin"),"directoryCompanies/mtc"),company));
  await assertSucceeds(getDocs(collection(dbFor("admin"),"directoryCompanies")));
  await assertFails(setDoc(doc(dbFor("admin"),"sectors/empty"),{name:""}));
  await assertFails(setDoc(doc(dbFor("admin"),"directoryCompanies/x"),{name:"X"}));
  await assertFails(deleteDoc(doc(dbFor("admin"),"sectors/towel")));
  for(const uid of ["client","freelancer"]){
    await assertFails(getDocs(collection(dbFor(uid),"sectors")));
    await assertFails(getDoc(doc(dbFor(uid),"directoryCompanies/mtc")));
    await assertFails(setDoc(doc(dbFor(uid),"directoryCompanies/y"),company));
  }
});
test("lojistik akışı: ön koşul ve kimlik kontrolü, paralel dal, yeni dönem",async()=>{
  const database=dbFor("admin");
  const make=(path:string,stepId:string)=>{
    const batch=writeBatch(database),eventId=`event-${stepId}`;
    batch.set(doc(database,path),{id:`logistics-${stepId}`,projectId:"a",stepId,workflow:"logistics",workflowStatus:"completed",assigneeUid:"admin",approverUid:"approver",completedBy:"admin",dueDate:"2026-10-20",approval:"pending",evidenceName:"Belge",evidenceUrl:"https://drive.google.com/test",lastEventId:eventId});
    batch.set(doc(database,"projects/a/events",eventId),{projectId:"a",actorUid:"admin",at:serverTimestamp(),action:"workflow_save",entityId:stepId,detail:"test"});return batch.commit();
  };
  await assertSucceeds(make("sopSteps/a_logistics-B.B.3","B.B.3"));
  await assertFails(make("sopSteps/a_logistics-B.A.2","B.A.2"));
  await assertFails(make("sopSteps/a_sourcing-B.A.1","B.A.1"));
  await assertFails(make("sopSteps/a_logistics-A.A.1","A.A.1"));
  await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();for(const id of ["B.A.6","B.A.7"])await setDoc(doc(db,`sopSteps/a_logistics-${id}`),{id:`logistics-${id}`,projectId:"a",stepId:id,workflow:"logistics",workflowStatus:"completed",approval:"approved",assigneeUid:"admin",approverUid:"approver",completedBy:"admin",dueDate:"2026-10-20",evidenceName:"Belge",evidenceUrl:"https://drive.google.com/test"});});
  await assertSucceeds(make("sopSteps/a_logistics-B.A.11","B.A.11"));
  await assertFails(make("sopSteps/a_logistics-B.A.9","B.A.9"));
  const period=(history:number,eventId:string)=>{const batch=writeBatch(database);batch.update(doc(database,"sopSteps/a_logistics-B.A.7"),{periodHistory:Array.from({length:history},(_, i)=>({period:i+1})),approval:"none",workflowStatus:"not_started",status:"Pending",completedBy:"",evidenceName:"",evidenceUrl:"",dueDate:"",notes:"",updatedAt:serverTimestamp(),lastEventId:eventId});batch.set(doc(database,"projects/a/events",eventId),{projectId:"a",actorUid:"admin",at:serverTimestamp(),action:"workflow_period",entityId:"B.A.7",detail:"test"});return batch.commit();};
  await assertFails(period(2,"period-skip"));
  await assertSucceeds(period(1,"period-ok"));
});
test("yeni PO döngüsü: B.A zinciri yalnızca önceki döngü kapandıysa ve birlikte açılır",async()=>{
  const ids=Array.from({length:15},(_, i)=>`B.A.${i+1}`);
  await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();for(const id of ids)await setDoc(doc(db,`sopSteps/a_logistics-${id}`),{id:`logistics-${id}`,projectId:"a",stepId:id,workflow:"logistics",workflowStatus:"completed",approval:"approved",assigneeUid:"admin",approverUid:"approver",completedBy:"admin",dueDate:"2026-10-20",evidenceName:"Belge",evidenceUrl:"https://drive.google.com/test"});});
  const database=dbFor("admin");
  const reset=(steps:string[],eventId:string)=>{const batch=writeBatch(database);for(const id of steps)batch.update(doc(database,`sopSteps/a_logistics-${id}`),{cycleHistory:[{cycle:1}],workflowStatus:"not_started",status:"Pending",approval:"none",completedBy:"",rejectionReason:"",dueDate:"",evidenceName:"",evidenceUrl:"",notes:"",updatedAt:serverTimestamp(),lastEventId:eventId});batch.set(doc(database,"projects/a/events",eventId),{projectId:"a",actorUid:"admin",at:serverTimestamp(),action:"workflow_cycle",entityId:"B.A.1",detail:"test"});return batch.commit();};
  await assertFails(reset(["B.A.1"],"cycle-single"));
  await assertFails(reset(ids.filter(id=>id!=="B.A.15"),"cycle-without-last"));
  await assertSucceeds(reset(ids,"cycle-all"));
  assert.equal((await getDoc(doc(database,"sopSteps/a_logistics-B.A.15"))).data()?.approval,"none");
});
test("B.B.1/B.B.6 planlama: admin ürün ve stok planını yazabilir, müşteri yazamaz",async()=>{
  for(const [uid,expect] of [["admin",assertSucceeds],["client",assertFails]] as const){
    const database=dbFor(uid),batch=writeBatch(database);
    batch.update(doc(database,"projects/a/products/sku"),{forecastDailySales:2.5,leadTimeDays:14,safetyStock:20});
    batch.update(doc(database,"projects/a/stock/sku"),{safetyStock:20});
    await expect(batch.commit());
  }
});

// ---- Ürün reçetesi (A.B.8) ----
const specDoc=(id:string,manufacturerId:string,status:"draft"|"review"|"approved",extra:Record<string,unknown>={})=>{
  const spec=createSpec({projectId:"a",manufacturerId,manufacturerName:manufacturerId,productName:"Tortilla",preparedBy:"Test",createdBy:"admin"});
  return {...spec,id,lineageId:`line-${id}`,status,...(status==="approved"?{approval:signed}:{}),...extra};
};
const signed={trade2turkey:{name:"T2T",date:"2026-10-18"},manufacturer:{name:"Üretici",date:"2026-10-18"},signedDocName:"",signedDocUrl:""};
const sop=(projectId:string,stepId:string,extra:Record<string,unknown>={})=>({id:`sourcing-${stepId}`,projectId,stepId,workflow:"sourcing",workflowStatus:"completed",approval:"approved",status:"Completed",assigneeUid:"admin",approverUid:"approver",completedBy:"admin",dueDate:"2026-10-20",evidenceName:"Belge",evidenceUrl:"https://drive.google.com/test",...extra});
const seedSpecs=(ab7:Record<string,unknown>={highPotentialManufacturerId:"m1"},projectId="a")=>env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore();
  for(const id of ["m1","m2"])await setDoc(doc(db,`projects/${projectId}/manufacturers/${id}`),{name:id});
  await setDoc(doc(db,`sopSteps/${projectId}_sourcing-A.B.6`),sop(projectId,"A.B.6"));
  await setDoc(doc(db,`sopSteps/${projectId}_sourcing-A.B.7`),sop(projectId,"A.B.7",ab7));
  await setDoc(doc(db,`projects/${projectId}/productSpecs/approved-m1`),{...specDoc("approved-m1","m1","approved"),projectId});
  await setDoc(doc(db,`projects/${projectId}/productSpecs/draft-m1`),{...specDoc("draft-m1","m1","draft"),projectId});
  await setDoc(doc(db,`projects/${projectId}/productSpecs/approved-m2`),{...specDoc("approved-m2","m2","approved"),projectId});
});
// A.B.x kaydını "onaya gönder" (approval: pending) olarak yazar; olay kaydı aynı işlemde.
const submit=(stepId:string,fields:Record<string,unknown>,projectId="a")=>{
  const database=dbFor("admin"),batch=writeBatch(database),eventId=`submit-${stepId}-${Math.random().toString(36).slice(2)}`;
  batch.set(doc(database,`sopSteps/${projectId}_sourcing-${stepId}`),{...sop(projectId,stepId),approval:"pending",lastEventId:eventId,...fields});
  batch.set(doc(database,`projects/${projectId}/events`,eventId),{projectId,actorUid:"admin",at:serverTimestamp(),action:"workflow_save",entityId:stepId,detail:"test"});
  return batch.commit();
};
test("ürün reçetesi: onaylı versiyon değiştirilemez ve silinemez; onay için iki imza gerekir; yalnızca admin yazar",async()=>{
  await seedSpecs();
  const database=dbFor("admin");
  await assertSucceeds(setDoc(doc(database,"projects/a/productSpecs/new"),specDoc("new","m1","draft")));
  await assertFails(setDoc(doc(database,"projects/a/productSpecs/direct"),specDoc("direct","m1","approved")));
  await assertFails(setDoc(doc(dbFor("client"),"projects/a/productSpecs/client"),specDoc("client","m1","draft")));
  await assertSucceeds(getDoc(doc(dbFor("client"),"projects/a/productSpecs/approved-m1")));
  const draftRef=doc(database,"projects/a/productSpecs/draft-m1"),draft=(await getDoc(draftRef)).data()!;
  await assertFails(setDoc(draftRef,{...draft,status:"approved"}));
  await assertFails(setDoc(draftRef,{...draft,lineageId:"other"}));
  await assertFails(setDoc(draftRef,{...draft,approval:{...draft.approval,signedDocUrl:"http://insecure"}}));
  await assertSucceeds(setDoc(draftRef,{...draft,status:"approved",approval:signed}));
  await assertFails(updateDoc(draftRef,{"general.productName":"Değişti"}));
  await assertFails(updateDoc(doc(database,"projects/a/productSpecs/approved-m1"),{status:"draft"}));
  await assertFails(deleteDoc(doc(database,"projects/a/productSpecs/approved-m1")));
  await assertSucceeds(setDoc(doc(database,"projects/a/productSpecs/v11"),{...specDoc("v11","m1","draft"),lineageId:"line-approved-m1",version:"v1.1",previousVersionId:"approved-m1"}));
});
test("ürün reçetesi: A.B.7 üreticisinin onaylı reçetesi olmadan A.B.8 onaya gönderilemez",async()=>{
  await seedSpecs();
  await assertFails(submit("A.B.8",{}));
  await assertFails(submit("A.B.8",{approvedSpecId:"draft-m1"}));
  await assertFails(submit("A.B.8",{approvedSpecId:"approved-m2"}));
  // A.B.7 seçimi varken A.B.8'deki yedek seçim kullanılamaz.
  await assertFails(submit("A.B.8",{approvedSpecId:"approved-m2",specManufacturerId:"m2"}));
  await assertFails(submit("A.B.8",{approvedSpecId:"missing"}));
  await assertSucceeds(submit("A.B.8",{approvedSpecId:"approved-m1"}));
});
test("ürün reçetesi: A.B.7 seçimsiz onaylandıysa A.B.8'deki tek seferlik üretici seçimi kullanılır",async()=>{
  await seedSpecs({});
  await assertFails(submit("A.B.8",{approvedSpecId:"approved-m2"}));
  await assertFails(submit("A.B.8",{approvedSpecId:"approved-m1",specManufacturerId:"m2"}));
  await assertSucceeds(submit("A.B.8",{approvedSpecId:"approved-m2",specManufacturerId:"m2",specManufacturerFallback:true}));
});
test("ürün reçetesi: yeni A.B.7 gönderimi kasadaki bir üreticiyi seçmeli",async()=>{
  await seedSpecs();
  await env.withSecurityRulesDisabled(async context=>{await deleteDoc(doc(context.firestore(),"sopSteps/a_sourcing-A.B.7"));});
  await assertFails(submit("A.B.7",{}));
  await assertFails(submit("A.B.7",{highPotentialManufacturerId:"yok"}));
  await assertSucceeds(submit("A.B.7",{highPotentialManufacturerId:"m1",highPotentialManufacturerName:"m1"}));
});
test("ürün reçetesi: daha önce onaylanmış veya onayda bekleyen A.B.8 kayıtları etkilenmez",async()=>{
  await seedSpecs({});
  // Kural öncesi onaylanmış A.B.8 (reçete bağlantısı yok): okunur ve A.B.9 bu onaya dayanarak ilerleyebilir.
  await env.withSecurityRulesDisabled(async context=>{await setDoc(doc(context.firestore(),"sopSteps/a_sourcing-A.B.8"),sop("a","A.B.8"));});
  await assertSucceeds(getDoc(doc(dbFor("client"),"sopSteps/a_sourcing-A.B.8")));
  await assertSucceeds(submit("A.B.9",{}));
  // Kural öncesi onaya gönderilmiş A.B.8 (bağlantısız): atanmış onaylayan yine onaylayabilir.
  await seedSpecs({},"b");
  await env.withSecurityRulesDisabled(async context=>{await setDoc(doc(context.firestore(),"sopSteps/b_sourcing-A.B.8"),{...sop("b","A.B.8"),approval:"pending"});});
  const approverDb=dbFor("approver"),batch=writeBatch(approverDb);
  batch.update(doc(approverDb,"sopSteps/b_sourcing-A.B.8"),{approval:"approved",decidedBy:"approver",updatedAt:serverTimestamp(),lastEventId:"legacy-approve"});
  batch.set(doc(approverDb,"projects/b/events/legacy-approve"),{projectId:"b",actorUid:"approver",at:serverTimestamp(),action:"workflow_approve",entityId:"A.B.8",detail:"Onaylandı"});
  await assertSucceeds(batch.commit());
});
test("iddia eşikleri: herkes okur, yalnızca yönetici yazar",async()=>{
  const value={id:"EU",market:"Avrupa Birliği",levels:{salt:{low:0.3,high:1.5}},claims:[]};
  await assertFails(setDoc(doc(dbFor("client"),"claimThresholds/EU"),value));
  await assertFails(setDoc(doc(dbFor("freelancer"),"claimThresholds/EU"),value));
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(),"claimThresholds/EU"),value));
  await assertSucceeds(setDoc(doc(dbFor("admin"),"claimThresholds/EU"),value));
  // Belge kimliği pazar koduyla aynı olmalı.
  await assertFails(setDoc(doc(dbFor("admin"),"claimThresholds/UK"),{...value}));
  await assertSucceeds(getDoc(doc(dbFor("client"),"claimThresholds/EU")));
  await assertFails(deleteDoc(doc(dbFor("client"),"claimThresholds/EU")));
});
test("dil tercihi: kullanıcı kendi profiline yalnızca tr/en yazabilir, başkasınınkine yazamaz",async()=>{
  await assertSucceeds(updateDoc(doc(dbFor("client"),"users/client"),{language:"en"}));
  await assertSucceeds(updateDoc(doc(dbFor("client"),"users/client"),{language:"tr"}));
  await assertFails(updateDoc(doc(dbFor("client"),"users/client"),{language:"de"}));
  await assertFails(updateDoc(doc(dbFor("client"),"users/client"),{language:1}));
  await assertFails(updateDoc(doc(dbFor("other"),"users/client"),{language:"en"}));
  await assertSucceeds(updateDoc(doc(dbFor("admin"),"users/client"),{language:"en"}));
});

test("iki dilli rehber admin tarafından yazılır; TR/kimlik korunur ve diğer rollere kapalıdır",async()=>{
 const admin=dbFor('admin'),sector=doc(admin,'sectors/bilingual'),company=doc(admin,'directoryCompanies/bilingual');
 await assertSucceeds(setDoc(sector,{name:'Havlu',archived:false,translations:{en:{name:'Towels & Bathrobes'}}}));
 const original={name:'Evliyaoğlu Tekstil',sectorId:'bilingual',description:'Üretici',location:'Denizli, Honaz',contacts:[{id:'emel',name:'Emel Özler',title:'Pazarlama Müdürü',phone:'',email:''}]};
 await assertSucceeds(setDoc(company,original));
 await assertSucceeds(updateDoc(company,{'translations.en.description':'Manufacturer','translations.en.contactTitles.emel':'Marketing Manager'}));
 const {translations,...unchanged}=(await getDoc(company)).data()!;assert.deepEqual(unchanged,original);
 assert.equal(translations.en.contactTitles.emel,'Marketing Manager');
 for(const uid of ['client','freelancer']){
  await assertFails(updateDoc(doc(dbFor(uid),'sectors/bilingual'),{'translations.en.name':'Changed'}));
  await assertFails(updateDoc(doc(dbFor(uid),'directoryCompanies/bilingual'),{'translations.en.description':'Changed'}));
  await assertFails(getDoc(doc(dbFor(uid),'directoryCompanies/bilingual')));
 }
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'sectors/bilingual')));
});

// ---- COGS (A.B.5) → RFQ (A.B.6) ----
// Yazımlar uygulamadaki biçimle aynıdır: alan whitelist'i yoktur, yalnızca adım kuralları ve alan sayısı (≤40) geçerlidir.
const withEvent=async(stepId:string,data:Record<string,unknown>,merge=false)=>{
  const database=dbFor("admin"),batch=writeBatch(database),eventId=`e-${stepId}-${Math.random().toString(36).slice(2)}`;
  batch.set(doc(database,`sopSteps/a_sourcing-${stepId}`),{...data,lastEventId:eventId},{merge});
  batch.set(doc(database,"projects/a/events",eventId),{projectId:"a",actorUid:"admin",at:serverTimestamp(),action:"workflow_save",entityId:stepId,detail:"test"});
  return batch.commit();
};
const cogsShortlist=[{id:"s1",name:"Anadolu Fırın",openBookAgreed:true},{id:"s2",name:"Ege Gıda"}];
const cogsSheet=()=>{const sheet=reconcileCogs(createCogsSheet(en.cogs.defaults,"Tortilla"),cogsShortlist,undefined,n=>`Manufacturer ${n}`);sheet.lines[0].values.s1="0,40";sheet.manufacturers[0]={...sheet.manufacturers[0],quotedExw:"1,00",openBook:true};return JSON.parse(JSON.stringify(sheet));};
test("COGS: A.A.5 'open-book' alanı, A.B.5 cogsBreakdown kaydı ve A.B.6'ya gönderim admin için yazılabilir",async()=>{
  await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();for(const id of ["A.A.4","A.B.4"])await setDoc(doc(db,`sopSteps/a_sourcing-${id}`),sop("a",id));});
  await assertSucceeds(withEvent("A.A.5",{id:"sourcing-A.A.5",projectId:"a",workflow:"sourcing",stepId:"A.A.5",section:"A",workflowStatus:"in_progress",status:"In Progress",approval:"none",supplierShortList:cogsShortlist.map(item=>({...item,product:"",location:"",contact:"",email:"",phone:"",website:"",notes:""}))}));
  await assertSucceeds(submit("A.B.5",{cogsBreakdown:cogsSheet()}));
  const matrix=syncMatrixFromCogs(reconcileMatrix(createMatrix("Tortilla"),cogsShortlist,cogsSheet(),n=>`Manufacturer ${n}`),cogsSheet(),true);
  await assertSucceeds(withEvent("A.B.6",{id:"sourcing-A.B.6",projectId:"a",workflow:"sourcing",stepId:"A.B.6",section:"A",workflowStatus:"not_started",status:"Pending",approval:"none",rfqComparisonMatrix:JSON.parse(JSON.stringify(matrix))},true));
  // Müşteri COGS verisini değiştiremez.
  await assertFails(updateDoc(doc(dbFor("client"),"sopSteps/a_sourcing-A.B.5"),{cogsBreakdown:{}}));
});
test("COGS: onaylı A.B.6 matrisine gönderim reddedilir",async()=>{
  await env.withSecurityRulesDisabled(async context=>{await setDoc(doc(context.firestore(),"sopSteps/a_sourcing-A.B.6"),sop("a","A.B.6"));});
  await assertFails(withEvent("A.B.6",{rfqComparisonMatrix:{brief:"x"},updatedAt:serverTimestamp()},true));
});
test("BOM: A.B.9 bomComparison kaydı admin için yazılabilir, müşteri değiştiremez",async()=>{
  const bom=JSON.parse(JSON.stringify(reconcileBom(createBomSheet(cogsSheet(),en.cogs.defaults),cogsShortlist,cogsSheet(),undefined,n=>`Manufacturer ${n}`)));
  bom.lines[0].values.s1={recipePct:"80",qty:"500",price:"0,80",origin:"TR"};
  await assertSucceeds(withEvent("A.B.9",{id:"sourcing-A.B.9",projectId:"a",workflow:"sourcing",stepId:"A.B.9",section:"A",workflowStatus:"not_started",status:"Pending",approval:"none",notes:"",recipeCostLines:[],recipeCostSource:null,bomComparison:bom}));
  await assertFails(updateDoc(doc(dbFor("client"),"sopSteps/a_sourcing-A.B.9"),{bomComparison:{}}));
});
test("proje adı: nameEn yalnızca admin tarafından ve metin olarak yazılabilir",async()=>{
  await assertSucceeds(updateDoc(doc(dbFor("admin"),"projects/a"),{nameEn:"Bakery Products Project"}));
  await assertFails(updateDoc(doc(dbFor("admin"),"projects/a"),{nameEn:123}));
  await assertFails(updateDoc(doc(dbFor("admin"),"projects/a"),{nameEn:"x".repeat(201)}));
  await assertFails(updateDoc(doc(dbFor("client"),"projects/a"),{nameEn:"Hacked"}));
  await assertFails(updateDoc(doc(dbFor("freelancer"),"projects/a"),{nameEn:"Hacked"}));
  await assertSucceeds(setDoc(doc(dbFor("admin"),"projects/new"),{id:"new",name:"Yeni Proje",nameEn:"New Project"}));
  await assertFails(setDoc(doc(dbFor("admin"),"projects/new2"),{id:"new2",name:"Yeni",nameEn:["x"]}));
});

// Buyers use synthetic contacts only; private CSV contents must never enter fixtures.
const buyerCountry={name:'United Kingdom',isoCode:'GB',archived:false};
const buyerType={name:'Retailer',archived:false};
const buyerCompany={name:'Example Foods',countryId:'gb',typeId:'retailer',website:'https://example.invalid',city:'London',categories:'Juices',notes:'',archived:false};
const buyerContact={companyId:'example',name:'Alex Buyer',title:'Buyer',category:'Juices',email:'alex@example.invalid',phone:'',outreachBatch:'Batch A',status:'Not contacted',lastContacted:'',notes:'',sharedMailbox:false,archived:false};
const buyerSamples=[['buyerCountries','gb',buyerCountry],['buyerCompanyTypes','retailer',buyerType],['buyerCompanies','example',buyerCompany],['buyerContacts','alex',buyerContact]] as const;
async function seedBuyerDirectory(){const db=dbFor('admin');const batch=writeBatch(db);for(const [name,id,data]of buyerSamples)batch.set(doc(db,name,id),{...data,updatedAt:serverTimestamp()});await assertSucceeds(batch.commit());}
test('buyers: admin can list, create, edit and archive all levels; hard deletes are denied',async()=>{
 await seedBuyerDirectory();const db=dbFor('admin');
 for(const [name,id]of buyerSamples){await assertSucceeds(getDocs(collection(db,name)));await assertSucceeds(getDoc(doc(db,name,id)));await assertSucceeds(updateDoc(doc(db,name,id),{archived:true,updatedAt:serverTimestamp()}));await assertFails(deleteDoc(doc(db,name,id)));}
 await assertSucceeds(setDoc(doc(db,'buyerCompanyTypes','distributor'),{...buyerType,name:'Distributor',updatedAt:serverTimestamp()}));
 await assertSucceeds(updateDoc(doc(db,'buyerCompanies','example'),{typeId:'distributor',updatedAt:serverTimestamp()}));
 await assertSucceeds(updateDoc(doc(db,'buyerContacts','alex'),{status:'Replied',lastContacted:'2026-10-21',sharedMailbox:true,updatedAt:serverTimestamp()}));
});
test('buyers: anonymous users, clients and freelancers cannot get/list/create/update/delete any buyer collection',async()=>{
 await seedBuyerDirectory();
 for(const db of [env.unauthenticatedContext().firestore(),dbFor('client'),dbFor('freelancer')])for(const [name,id,data]of buyerSamples){
  await assertFails(getDocs(collection(db,name)));await assertFails(getDoc(doc(db,name,id)));
  await assertFails(setDoc(doc(db,name,'unauthorized'),{...data,updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(db,name,id),{archived:true,updatedAt:serverTimestamp()}));await assertFails(deleteDoc(doc(db,name,id)));
 }
});
test('buyers: forged admin claims without admin profile, profile-only admins and suspended admins are rejected',async()=>{
 await seedBuyerDirectory();
 const forged=env.authenticatedContext('client',{admin:true}).firestore();await assertFails(getDocs(collection(forged,'buyerContacts')));
 const noClaim=env.authenticatedContext('admin',{}).firestore();await assertFails(getDocs(collection(noClaim,'buyerContacts')));
 await updateDoc(doc(dbFor('admin'),'users/admin'),{status:'suspended'});await assertFails(getDocs(collection(dbFor('admin'),'buyerContacts')));
});
test('buyers: validators apply on both create and update, reject invalid types, unknown fields and oversized text',async()=>{
 await seedBuyerDirectory();const db=dbFor('admin');
 const invalid:[string,string,any][]=[
  ['buyerCountries','gb',{name:'x'.repeat(101)}],['buyerCountries','gb',{isoCode:'United Kingdom'}],['buyerCountries','gb',{archived:'yes'}],
  ['buyerCompanyTypes','retailer',{name:5}],['buyerCompanies','example',{website:'javascript:alert(1)'}],['buyerCompanies','example',{city:'x'.repeat(251)}],
  ['buyerCompanies','example',{categories:'x'.repeat(2001)}],['buyerCompanies','example',{notes:'x'.repeat(4001)}],['buyerCompanies','example',{countryId:'missing'}],['buyerCompanies','example',{typeId:'missing'}],
  ['buyerContacts','alex',{name:'x'.repeat(251)}],['buyerContacts','alex',{title:'x'.repeat(251)}],['buyerContacts','alex',{category:'x'.repeat(1001)}],
  ['buyerContacts','alex',{email:'invalid email'}],['buyerContacts','alex',{phone:'x'.repeat(101)}],['buyerContacts','alex',{outreachBatch:'x'.repeat(251)}],
  ['buyerContacts','alex',{notes:'x'.repeat(4001)}],['buyerContacts','alex',{status:'Secret'}],['buyerContacts','alex',{lastContacted:'yesterday'}],
  ['buyerContacts','alex',{sharedMailbox:'true'}],['buyerContacts','alex',{companyId:'missing'}],['buyerContacts','alex',{name:'',email:''}],
  ['buyerContacts','alex',{extra:'unrecognised'}],['buyerContacts','alex',{updatedAt:new Date('2000-01-01')}],
 ];
 for(const [name,id,patch]of invalid){const sample=buyerSamples.find(([collection])=>collection===name)![2];
  await assertFails(setDoc(doc(db,name,'invalid'),{...sample,updatedAt:serverTimestamp(),...patch}));
  await assertFails(updateDoc(doc(db,name,id),{updatedAt:serverTimestamp(),...patch}));
 }
 await assertFails(setDoc(doc(db,'buyerContacts','missing-required'),{name:'Name',updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(doc(db,'buyerCompanies','example'),{name:'' ,updatedAt:serverTimestamp()}));
 // A contact cannot silently be reassigned to a different company.
 await assertSucceeds(setDoc(doc(db,'buyerCompanies','other'),{...buyerCompany,name:'Other Company',updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(doc(db,'buyerContacts','alex'),{companyId:'other',updatedAt:serverTimestamp()}));
});
test('buyers: real-world email and website syntax accepts s characters and rejects whitespace',async()=>{
 await seedBuyerDirectory();const db=dbFor('admin');
 await assertSucceeds(updateDoc(doc(db,'buyerContacts','alex'),{email:'sales@suppliers.example',updatedAt:serverTimestamp()}));
 await assertSucceeds(updateDoc(doc(db,'buyerCompanies','example'),{website:'https://www.suppliers.example',updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(doc(db,'buyerContacts','alex'),{email:'a b@example.invalid',updatedAt:serverTimestamp()}));
});
test('buyer tracking: optional fields work on legacy records; admin tracking edits retain import provenance',async()=>{
 await seedBuyerDirectory();const db=dbFor('admin'),ref=doc(db,'buyerContacts','alex');
 const tracking={priority:'A',emailStatus:'Sent',plannedSendDate:'2026-10-20',sentDate:'2026-10-20',followUpDate:'2026-10-21',salutation:'Dear Alex',emailSubject:'Example subject',callToAction:'20-min call',replyChannel:'Auto-reply',replySummary:'First event | Second event',linkedinUrl:'https://www.linkedin.com/in/alex',linkedinStatus:'Connected',linkedinMessageSent:'Yes',linkedinDegree:'2nd',linkedinInviteOrder:5,linkedinInviteDate:'2026-10-19',linkedinCurrentTitle:'Buyer',linkedinCurrentCompany:'Example Foods',stillAtCompany:'Left (moved to Example)',lastChecked:'2026-10-21',manualFields:['notes','emailStatus']};
 await assertSucceeds(updateDoc(ref,{...tracking,updatedAt:serverTimestamp()}));
 const importDate=new Date('2026-10-20T12:00:00Z');await env.withSecurityRulesDisabled(async context=>{await updateDoc(doc(context.firestore(),'buyerContacts','alex'),{importedAt:importDate});});
 await assertSucceeds(updateDoc(ref,{notes:'Manual note',manualUpdatedAt:serverTimestamp(),updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(ref,{importedAt:serverTimestamp(),updatedAt:serverTimestamp()}));
 for(const role of ['client','freelancer'])await assertFails(updateDoc(doc(dbFor(role),'buyerContacts','alex'),{emailStatus:'Replied',updatedAt:serverTimestamp()}));
});
test('buyer tracking: both create and update reject malformed enums, dates, links, metadata and unbounded text',async()=>{
 await seedBuyerDirectory();const db=dbFor('admin');
 const invalid=[{priority:'D'},{emailStatus:'Unknown'},{plannedSendDate:'tomorrow'},{sentDate:123},{followUpDate:'21/10/2026'},{salutation:'x'.repeat(251)},{emailSubject:'x'.repeat(1001)},{callToAction:'Spam'},{replyChannel:'SMS'},{replySummary:'x'.repeat(8001)},{linkedinUrl:'https://linkedin.com.evil.invalid/in/a'},{linkedinUrl:'javascript:alert(1)'},{linkedinStatus:'Pending'},{linkedinMessageSent:true},{linkedinDegree:'4th'},{linkedinInviteOrder:-1},{linkedinInviteOrder:1.5},{linkedinInviteOrder:1000001},{linkedinInviteOrder:'2'},{linkedinInviteDate:'today'},{linkedinCurrentTitle:'x'.repeat(501)},{linkedinCurrentCompany:'x'.repeat(251)},{stillAtCompany:'Maybe'},{lastChecked:'today'},{manualFields:['unknownField']},{manualFields:Array(33).fill('notes')},{importedAt:'not-a-timestamp'},{manualUpdatedAt:'not-a-timestamp'},{manualUpdatedAt:new Date('2000-01-01')}];
 for(const patch of invalid){
  await assertFails(setDoc(doc(db,'buyerContacts','invalid-tracking'),{...buyerContact,...patch,updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(db,'buyerContacts','alex'),{...patch,updatedAt:serverTimestamp()}));
 }
});
