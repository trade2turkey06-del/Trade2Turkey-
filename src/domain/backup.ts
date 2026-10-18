import { message as msg } from "../i18n";
export const rootCollections = ["sopSteps","targetSpecs","rfqs","valueChain","rfqMatrix","recipes","suppliers","shipments","inventory","fulfillmentOrders","driveFiles","leads"];
export const projectCollections = ["manufacturers","market_insights","products","vendors","quotes","purchaseOrders","salesOrders","stock","shipmentRecords","events"];
export interface Backup { version: 1; projectId: string; createdAt: string; records: { path: string; data: Record<string, any> }[]; }
export function validateBackup(value: any, projectId: string): asserts value is Backup {
  if (!value || value.version !== 1 || value.projectId !== projectId || !Array.isArray(value.records) || value.records.length > 20000) throw new Error(msg("actionCenter", "invalidBackupVersionOrProjectId"));
  const seen = new Set<string>();
  for (const record of value.records) {
    if (!record || typeof record.path !== "string" || !record.data || typeof record.data !== "object" || Array.isArray(record.data)) throw new Error(msg("actionCenter", "invalidBackupRecord"));
    const parts = record.path.split("/");
    const validRoot = parts.length === 2 && rootCollections.includes(parts[0]) && record.data.projectId === projectId;
    const validChild = parts.length === 4 && parts[0] === "projects" && parts[1] === projectId && projectCollections.includes(parts[2]) && record.data.projectId === projectId;
    const validProject = record.path === `projects/${projectId}`;
    if ((!validRoot && !validChild && !validProject) || parts.some(part => !part || part === "." || part === "..") || seen.has(record.path)) throw new Error(msg("actionCenter", "theBackupContainsDuplicateRecordsOrRecordsOutsideThis"));
    seen.add(record.path);
  }
}
