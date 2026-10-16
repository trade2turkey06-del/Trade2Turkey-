import test from "node:test";
import assert from "node:assert/strict";
import { reserve, ship, cancel, receive, reorderPoint, safeHttps, stockPlan, validatePlanning, type SalesOrder } from "../src/domain/operations";
import { affectedSteps, canAdvance, dependencies, validateCompletion } from "../src/domain/workflow";
import { logisticsWorkflow } from "../src/data/logisticsWorkflow";
import { validateBackup } from "../src/domain/backup";
import { createRateLimiter, hasProjectAccess } from "../server/security";
import { trustedAdministrator } from "../src/domain/access";

const stock = { productId: "sku", physical: 10, reserved: 0, safetyStock: 2 };
const order: SalesOrder = { id: "sale", productId: "sku", quantity: 6, reservedQty: 0, shippedQty: 0, cancelledQty: 0, status: "draft", customer: "Test", platform: "B2B" };
test("sipariş miktarını karşılamayan stok rezerve edilemez",()=>assert.throws(()=>reserve({...stock,physical:5},order)));
test("rezervasyon, kısmi sevk ve kalan iptal stokla uzlaşır",()=>{
  const reserved=reserve(stock,order);assert.equal(reserved.stock.reserved,6);assert.equal(reserved.stock.physical,10);
  const partial=ship(reserved.stock,reserved.order,2);assert.equal(partial.stock.physical,8);assert.equal(partial.stock.reserved,4);assert.equal(partial.order.status,"partial");
  const cancelled=cancel(partial.stock,partial.order);assert.equal(cancelled.stock.physical,8);assert.equal(cancelled.stock.reserved,0);assert.equal(cancelled.order.cancelledQty,4);assert.equal(cancelled.order.shippedQty,2);
});
test("tekrar rezervasyon/sevkiyat/iptal ve negatif miktarlar engellenir",()=>{
  const reserved=reserve(stock,order);assert.throws(()=>reserve(reserved.stock,reserved.order));assert.throws(()=>ship(reserved.stock,reserved.order,7));assert.throws(()=>ship(reserved.stock,reserved.order,-1));
  const shipped=ship(reserved.stock,reserved.order,6);assert.throws(()=>ship(shipped.stock,shipped.order,1));assert.throws(()=>cancel(shipped.stock,shipped.order));
});
test("kısmi tedarik teslimi kalan miktarı aşamaz",()=>{assert.equal(receive(stock,10,3,7).stock.physical,17);assert.throws(()=>receive(stock,10,3,8));});
test("yeniden sipariş noktası tahmin, tedarik süresi ve emniyet stoğunu içerir",()=>{assert.equal(reorderPoint(2.5,3,4),12);assert.throws(()=>reorderPoint(-1,3,4));});
test("belge, kişi ayrımı ve onay ön koşulları zorunlu",()=>{
  assert.throws(()=>validateCompletion({stepId:"A.A.1",workflowStatus:"completed"}));
  validateCompletion({stepId:"A.A.1",workflowStatus:"completed",assigneeUid:"a",approverUid:"b",dueDate:"2026-10-20",evidenceName:"NDA",evidenceUrl:"https://drive.google.com/file/d/test"});
  assert.deepEqual(canAdvance("A.B.12",{"A.B.10":{stepId:"A.B.10",workflowStatus:"completed",approval:"approved"}}),["A.B.11"]);
  assert(affectedSteps(["A.A.1"]).includes("A.B.14"));assert(!affectedSteps(["A.B.11"]).includes("A.B.10"));
});
test("yedekler proje dışı, rol ve yinelenen kayıtlara kapalı",()=>{
  const backup={version:1,projectId:"p",createdAt:"now",records:[{path:"projects/p/products/sku",data:{projectId:"p"}}]};validateBackup(backup,"p");
  assert.throws(()=>validateBackup(backup,"other"));assert.throws(()=>validateBackup({...backup,records:[{path:"users/admin",data:{projectId:"p"}}]},"p"));
  assert.throws(()=>validateBackup({...backup,records:[...backup.records,...backup.records]},"p"));
  assert.deepEqual(JSON.parse(JSON.stringify(backup)),backup);
});
test("yalnızca güvenli HTTPS bağlantısı kabul edilir",()=>{assert(safeHttps("https://drive.google.com/test"));assert(!safeHttps("javascript:alert(1)"));assert(!safeHttps("https://user:secret@example.com"));});
test("istek sınırı kullanıcı bazlı ve süre dolunca sıfırlanır",()=>{const allow=createRateLimiter(2,1000);assert(allow("a",0));assert(allow("a",1));assert(!allow("a",2));assert(allow("b",2));assert(allow("a",1000));});
test("askıya alınmış veya başka projedeki kullanıcı servise erişemez",()=>{assert(!hasProjectAccess({role:"client",projectId:"a",assignedProjects:[],status:"active"},"b"));assert(!hasProjectAccess({role:"admin",projectId:"a",assignedProjects:[],status:"suspended"},"a"));});
test("profilde admin yazması tek başına yönetici yetkisi vermez",()=>{assert(!trustedAdministrator("random-uid",{role:"admin"}));assert(trustedAdministrator("claim-admin",{admin:true}));});
test("üretim & lojistik akışı paralel dallar ve bağımsız B.B adımlarıyla kurulur",()=>{
  const ok={workflowStatus:"completed" as const,approval:"approved" as const};
  assert.deepEqual(canAdvance("B.B.1",{}),[]);
  assert.deepEqual(canAdvance("B.A.9",{"B.A.7":{stepId:"B.A.7",...ok}}),["B.A.8"]);
  assert.deepEqual(canAdvance("B.A.12",{"B.A.10":{stepId:"B.A.10",...ok}}),["B.A.11"]);
  assert.deepEqual(canAdvance("B.B.6",{"B.B.1":{stepId:"B.B.1",...ok},"B.B.5":{stepId:"B.B.5",...ok}}),["B.B.2"]);
  assert.ok(!affectedSteps(["B.A.6"]).some(id=>id.startsWith("A.")||id.startsWith("B.B.")));
  assert.deepEqual(logisticsWorkflow.map(step=>step.id).filter(id=>id.startsWith("B.C.")),[]);
  assert.equal(logisticsWorkflow.length,21);
  for(const step of logisticsWorkflow) assert.equal(step.returnTo,(dependencies[step.id]??[]).join("/"),step.id);
  assert.equal(logisticsWorkflow.find(step=>step.id==="B.A.11")!.approvalDays,3);
  assert.equal(logisticsWorkflow.find(step=>step.id==="B.B.3")!.period,"Her ay");
});
test("stok planı: kullanılabilir = fiziksel − rezerve; sipariş noktası = günlük satış × termin + emniyet stoğu",()=>{
  assert.deepEqual(stockPlan({physical:120,reserved:30,safetyStock:20},{forecastDailySales:5,leadTimeDays:14}),{physical:120,reserved:30,available:90,safetyStock:20,reorderPoint:90,needsReorder:true});
  assert.equal(stockPlan({physical:200,reserved:30,safetyStock:20},{forecastDailySales:5,leadTimeDays:14}).needsReorder,false);
  assert.equal(stockPlan({physical:10,reserved:0,safetyStock:3},{forecastDailySales:2.5,leadTimeDays:3}).reorderPoint,11);
  assert.equal(stockPlan({physical:10,reserved:0,safetyStock:4}).reorderPoint,4);
  assert.throws(()=>validatePlanning({forecastDailySales:-1,leadTimeDays:5,safetyStock:0}));
  assert.throws(()=>validatePlanning({forecastDailySales:1,leadTimeDays:0,safetyStock:0}));
  assert.throws(()=>validatePlanning({forecastDailySales:1,leadTimeDays:2.5,safetyStock:0}));
  assert.throws(()=>validatePlanning({forecastDailySales:1,leadTimeDays:5,safetyStock:1.5}));
  assert.doesNotThrow(()=>validatePlanning({forecastDailySales:0,leadTimeDays:1,safetyStock:0}));
});
