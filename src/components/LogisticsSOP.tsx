import OperationsHub from "./OperationsHub";
export default function LogisticsSOP({ currentProjectId, isAdmin = false }: { currentProjectId: string; isAdmin?: boolean }) {
  return <OperationsHub projectId={currentProjectId} isAdmin={isAdmin} />;
}
