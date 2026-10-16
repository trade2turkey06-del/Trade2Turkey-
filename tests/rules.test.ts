import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { reserve } from "../src/domain/operations";

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
