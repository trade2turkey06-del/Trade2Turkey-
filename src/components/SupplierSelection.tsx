import OperationsHub from "./OperationsHub";

export default function SupplierSelection({ projectId }: { projectId: string }) {
  return <OperationsHub projectId={projectId} isAdmin initialTab="procurement" />;
}
