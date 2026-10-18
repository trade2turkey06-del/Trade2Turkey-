import { getMessages } from "../i18n";
import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { operationCollection } from "./operationsStore";

export function useProjectData(projectId: string, names: readonly string[]) {
  const [data, setData] = useState<Record<string, any[]>>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(names.length);
  const key = names.join(",");
  useEffect(() => {
    setData({}); setError(""); setPending(names.length);
    const loaded = new Set<string>();
    // Real-time stock/order snapshots are a requirement for concurrent operators.
    const stops = names.map(name => onSnapshot(operationCollection(projectId, name), snapshot => {
      setData(previous => ({ ...previous, [name]: snapshot.docs.map(item => ({ ...item.data(), id: item.id })) }));
      loaded.add(name); setPending(names.length - loaded.size);
    }, () => { setError(`${name}: ${getMessages().operations.recordsLoadFailed}`); loaded.add(name); setPending(names.length - loaded.size); }));
    return () => stops.forEach(stop => stop());
  }, [projectId, key]);
  return { data, error, loading: pending > 0 };
}
