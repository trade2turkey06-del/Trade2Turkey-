import test from "node:test";
import assert from "node:assert/strict";
import { reserve, ship, cancel, receive, reorderPoint, safeHttps, type SalesOrder } from "../src/domain/operations";
import { affectedSteps, canAdvance, validateCompletion } from "../src/domain/workflow";
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
