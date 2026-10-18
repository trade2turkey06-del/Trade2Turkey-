export const logistics = {
  "title": "Production & Logistics Workflow",
  "heading": "Production, Logistics & Inventory Management",
  "note": "From order placement to delivery and inventory planning",
  "groups": {
    "B.A.": {
      "title": "Production & Shipment Coordination",
      "subtitle": "Order-to-delivery shipment coordination"
    },
    "B.B.": {
      "title": "Inventory Planning & Forecasting",
      "subtitle": "Manage inventory levels and demand forecasts"
    }
  },
  "periods": {
    "Her gün takip": "Daily monitoring",
    "Her ay": "Monthly",
    "Her hafta": "Weekly",
    "Gerektiğinde": "As required"
  },
  "steps": {
    "B.A.1": {
      "name": "Purchase Order (PO) Issuance",
      "kpi": "PO accuracy: 100%",
      "output": "Signed purchase order sent to the manufacturer"
    },
    "B.A.2": {
      "name": "Purchase Order Confirmation",
      "kpi": "Order confirmation completed",
      "output": "Signed PO confirmation"
    },
    "B.A.3": {
      "name": "Signed Pro Forma Invoice",
      "kpi": "Pro forma invoice matches the PO: 100%",
      "output": "Pro forma invoice received"
    },
    "B.A.4": {
      "name": "Goods Ready Date Confirmation",
      "kpi": "Goods ready date meets the agreed lead time: 95%",
      "output": "Goods ready date confirmation email"
    },
    "B.A.5": {
      "name": "Advance Payment",
      "kpi": "Advance payment processed",
      "output": "Proof of payment / SWIFT confirmation"
    },
    "B.A.6": {
      "name": "Shipment Preparation Meeting",
      "kpi": "Coordination with the manufacturer’s logistics team and customs broker, where applicable",
      "output": "Shipment preparation meeting minutes"
    },
    "B.A.7": {
      "name": "Quality Checkpoint – Raw Materials",
      "kpi": "Required milestone approvals completed: 100%; raw material procurement verified",
      "output": "Raw material approval checklist"
    },
    "B.A.8": {
      "name": "Quality Checkpoint – Packaging",
      "kpi": "Required milestone approvals completed: 100%; packaging materials received at the facility",
      "output": "Packaging material approval checklist"
    },
    "B.A.9": {
      "name": "Quality Checkpoint – End of Production",
      "kpi": "Required milestone approvals completed: 100%; production completion verified",
      "output": "Production completion checklist"
    },
    "B.A.10": {
      "name": "Balance Payment",
      "kpi": "Balance payment completed within agreed payment terms",
      "output": "Balance payment receipt / SWIFT confirmation"
    },
    "B.A.11": {
      "name": "Freight Booking Confirmation",
      "kpi": "Confirmed vessel or truck booking date",
      "output": "Confirmed booking reference / draft bill of lading"
    },
    "B.A.12": {
      "name": "Dispatch Clearance – Truck / Vessel",
      "kpi": "Goods released for dispatch after document and load check",
      "output": "Commercial invoice, packing list and export customs declaration"
    },
    "B.A.13": {
      "name": "Shipping Documentation Checklist",
      "kpi": "Export customs documentation reviewed",
      "output": "Confirmed commercial invoice, packing list, bill of lading, certificate of origin and container tracking number"
    },
    "B.A.14": {
      "name": "Customs Broker Coordination",
      "kpi": "All required documents shared with the import customs broker",
      "output": "Customs broker coordination confirmation email"
    },
    "B.A.15": {
      "name": "Shipment Delivery Confirmation",
      "kpi": "On-time delivery",
      "output": "Delivery confirmation issued by the carrier"
    },
    "B.B.1": {
      "name": "Safety Stock Planning",
      "kpi": "Target days of inventory cover defined; safety stock calculation accuracy: 95%",
      "output": "Safety stock calculation spreadsheet"
    },
    "B.B.2": {
      "name": "Sales Forecasting",
      "kpi": "Consolidated B2C and B2B forecasts across all sales channels; forecast accuracy: at least 85%",
      "output": "Monthly sales forecast report"
    },
    "B.B.3": {
      "name": "Physical Inventory Verification",
      "kpi": "Actual warehouse quantities verified monthly",
      "output": "Physical inventory count report"
    },
    "B.B.4": {
      "name": "Committed Inventory Verification",
      "kpi": "Inventory allocated to confirmed B2C sales and B2B purchase orders is accurate: 100%",
      "output": "Open sales orders list"
    },
    "B.B.5": {
      "name": "Available Inventory Report",
      "kpi": "Available inventory = B.B.3 − B.B.4",
      "output": "Available inventory spreadsheet"
    },
    "B.B.6": {
      "name": "Reorder Point Calculation",
      "kpi": "Reorder point = forecast daily sales × supplier lead time + safety stock",
      "output": "Reorder point calculation spreadsheet"
    }
  }
};
