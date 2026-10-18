import { useI18n } from "../i18n";
import { message as msg } from "../i18n";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function LegacyOperations({ projectId }: { projectId: string }) {
  const { fmt } = useI18n();
  const [records,setRecords]=useState<Record<string,any[]>>({});
  useEffect(()=>{
    setRecords({});
    const stops=["shipments","inventory","fulfillmentOrders"].map(name=>onSnapshot(query(collection(db,name),where("projectId","==",projectId)),snapshot=>setRecords(previous=>({...previous,[name]:snapshot.docs.map(item=>({...item.data(),id:item.id}))})),()=>{}));
    return ()=>stops.forEach(stop=>stop());
  },[projectId]);
  if(!Object.values(records).some(items=>items.length)) return null;
  return <details className="rounded-2xl border bg-white p-5"><summary className="cursor-pointer font-bold">{msg("operations", "previousOperationsRecords")}</summary><p className="my-3 text-sm text-slate-600">{msg("operations", "existingRecordsHaveBeenPreservedLegacySampleDataDoes")}</p><ul className="space-y-3 text-sm">{Object.entries(records).flatMap(([name,items])=>items.map(item=><li key={`${name}-${item.id}`} className="rounded-lg border p-3">{name} · {item.productName||item.name||item.orderId||item.id} · {item.status||msg("operations", "statusNotSpecified")}{item.shipmentNumber&&<span> · {item.shipmentNumber}</span>}{item.sku&&<span> · SKU: {item.sku}</span>}</li>))}</ul></details>;
}
