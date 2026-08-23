export interface DriveFile {
  stepId: string;
  folderName: string;
  projectId: string;
  fileName: string;
  fileType: "PDF" | "RFQ Sheet" | "Certificate" | "Photoshoot Proof" | "Image" | "Agreement";
  downloadUrl: string;
  fileSize: string;
  dateAdded: string;
  fileId?: string;
  assignedTo?: string;
  userId?: string;
}

// Designation designated CSV representing the metadata database mapping task locations and security controls
export const DRIVE_MAPPING_CSV_RAW = `StepID,DigitalStoringLocation,ProjectID,FileName,FileType,DownloadURL,FileSize,DateAdded
A.A.1,Shared Folder - Unlu Mamüller Projesi -Target Specs Bean Bags,PROJE-UNLU MAMÜLLER,Target_Specification_Unlu Mamüller.pdf,PDF,#,3.5 MB,2026-05-22
A.A.1,Shared Folder - Unlu Mamüller Projesi -Target Specs Bean Bags,PROJE-UNLU MAMÜLLER,Color_Palettes_WarmSand_Fob.png,Image,#,2.4 MB,2026-05-22
A.A.2,Shared Folder - Unlu Mamüller Projesi - Long List Manufacturers,PROJE-UNLU MAMÜLLER,Turkish_Manufacturers_Long_List.xlsx,RFQ Sheet,#,1.8 MB,2026-05-29
A.A.3,Shared Folder - Unlu Mamüller Projesi - Supplier Assesment Forms,PROJE-UNLU MAMÜLLER,Anatolian_RFQ_Bid_Response.xls,RFQ Sheet,#,1.1 MB,2026-06-03
A.A.3,Shared Folder - Unlu Mamüller Projesi - Supplier Assesment Forms,PROJE-UNLU MAMÜLLER,Ege_RFQ_Bid_Response.xls,RFQ Sheet,#,1.4 MB,2026-06-03
A.A.5,Shared Folder - Unlu Mamüller Projesi - Costing Value Chain,PROJE-UNLU MAMÜLLER,Landed_Costing_Value_Chain_Output.xlsx,RFQ Sheet,#,2.2 MB,2026-06-09
A.A.6,Shared Folder - Signed NDA Vault,PROJE-UNLU MAMÜLLER,Signed_NDA_AnatolianTextiles.pdf,Agreement,#,1.4 MB,2026-06-16
A.A.6,Shared Folder - Signed NDA Vault,PROJE-UNLU MAMÜLLER,NDA_Mutilateral_EgeLiving.pdf,Agreement,#,950 KB,2026-06-17
A.A.7,Shared Folder - Sample Request Docs,PROJE-UNLU MAMÜLLER,Approved_Sample_Request_Unlu Mamüller.pdf,PDF,#,820 KB,2026-06-20
A.A.8,Shared Folder - COGS Sheets,PROJE-UNLU MAMÜLLER,COGS_Sheet_Anatolian_Breakdown.xlsx,RFQ Sheet,#,2.8 MB,2026-06-30
A.A.4,Shared Folder - Comparitive Matrix Vault,PROJE-UNLU MAMÜLLER,RFQ_Weighted_Comparative_Decision_Matrix.xlsx,RFQ Sheet,#,1.3 MB,2026-07-05
A.A.9,Shared Folder - Product Recipes,PROJE-UNLU MAMÜLLER,Unlu Mamüller_Product_Recipe_v1.2.xlsx,RFQ Sheet,#,1.1 MB,2026-07-15
A.A.9,Shared Folder - Granular Costing Sheet,PROJE-UNLU MAMÜLLER,Granular_Costing_Sewing_Zipper_Thread.xlsx,RFQ Sheet,#,920 KB,2026-07-20
A.A.12,Shared Folder - Final Specifications,PROJE-UNLU MAMÜLLER,Final_Unlu Mamüller_Specs_Approved.pdf,PDF,#,2.4 MB,2026-07-29
A.A.11,Shared Folder - Factory Audit Reports,PROJE-UNLU MAMÜLLER,Factory_Audit_Bursa_Anatolian_v2.pdf,PDF,#,4.2 MB,2026-08-01
A.A.13,Shared Folder - Signed Project Launch Sheet,PROJE-UNLU MAMÜLLER,Project_Launch_Approval_GM_Signed.pdf,PDF,#,1.6 MB,2026-08-12
A.A.14,Shared Folder - Pre-Production Minutes,PROJE-UNLU MAMÜLLER,Pre_Production_Meeting_FobLabel_SKU.pdf,PDF,#,1.1 MB,2026-08-17
A.A.15,Shared Folder - Signed Contracts,PROJE-UNLU MAMÜLLER,Mutually_Executed_Commercial_Contract.pdf,Agreement,#,5.2 MB,2026-08-20
B.A.1,Shared Folder - Sent POs,PROJE-UNLU MAMÜLLER,Purchase_Order_T2T_1002_Anatolian.pdf,PDF,#,2.3 MB,2026-08-21
B.A.2,Shared Folder - Acknowledged POs,PROJE-UNLU MAMÜLLER,PO_Acknowledgment_Signed_Anatolian.pdf,Agreement,#,1.8 MB,2026-08-25
B.A.3,Shared Folder - Proforma Invoices,PROJE-UNLU MAMÜLLER,Proforma_Invoice_PI_1002_Anatolian.pdf,PDF,#,1.9 MB,2026-08-27
B.A.5,Shared Folder - SWIFTs,PROJE-UNLU MAMÜLLER,Swift_Payment_Proof_30percent_Advance.pdf,Certificate,#,850 KB,2026-08-30
B.A.12,Shared Folder - Export Customs Docs,PROJE-UNLU MAMÜLLER,Commercial_Invoice_PackingList_Customs.pdf,PDF,#,3.1 MB,2026-09-30
B.A.13,Shared Folder - Custom Packs,PROJE-UNLU MAMÜLLER,Full_Bill_of_Lading_EUR1_ATR.pdf,PDF,#,4.4 MB,2026-10-02
B.C.7,Shared Folder - Cargo Proof Photos,PROJE-UNLU MAMÜLLER,Cargo_Barcode_And_Stitching_Proof.jpg,Photoshoot Proof,https://images.unsplash.com/photo-1512418491533-31f0cf871861,350 KB,2026-10-01
A.A.1,Shared Folder - Unlu Mamüller Projesi -Target Specs,PROJE-UNLU MAMÜLLER,Velvet_Ottoman_Target_Specs_Final.pdf,PDF,#,2.1 MB,2026-05-24
A.A.6,Shared Folder - Signed NDA Vault,PROJE-UNLU MAMÜLLER,NDA_Signed_Marmara_Home_Goods.pdf,Agreement,#,1.2 MB,2026-06-18
A.A.11,Shared Folder - Factory Audit Reports,PROJE-UNLU MAMÜLLER,Factory_Audit_Ege_Living_Izmir.pdf,PDF,#,3.8 MB,2026-05-25`;

/**
 * Parses the dynamic CSV configuration string representing designations on cloud folders
 */
export function parseCSVToDriveFiles(csvString: string): DriveFile[] {
  const lines = csvString.trim().split("\n");
  if (lines.length <= 1) return [];

  const files: DriveFile[] = [];
  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Simple comma separation (careful with quoted fields, none in our raw CSV but keep clean)
    const columns = line.split(",");
    if (columns.length < 8) continue;

    files.push({
      stepId: columns[0],
      folderName: columns[1],
      projectId: columns[2],
      fileName: columns[3],
      fileType: columns[4] as any,
      downloadUrl: columns[5],
      fileSize: columns[6],
      dateAdded: columns[7]
    });
  }

  return files;
}

/**
 * Mappings for Project IDs to friendly project naming
 */
export const PROJECT_NAMES: Record<string, string> = {
  "PROJE-UNLU MAMÜLLER": "Unlu Mamüller Projesi"
};
