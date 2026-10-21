import { retiredPageRedirect } from "./src/domain/navigation";
import { aiText } from "./server/language";
import { apiMessage, outputInstruction } from "./server/language";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { requireUser, hasProjectAccess } from "./server/security";
import express from "express";
import path from "path";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

// Load environment variables
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "disabled-free-only" });

const app = express();
const PORT = Number(process.env.PORT || 3000);
app.set("trust proxy", 1);
const oauthStates = new Map<string, { expires: number; cookie: string; uid: string }>();

// Setup multer for in-memory file parsing
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 8 }, fileFilter: (_req, file, callback) => {
  const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/csv", "text/plain", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  if (!allowed.includes(file.mimetype)) { callback(new Error("Dosya türü desteklenmiyor.")); return; }
  callback(null, true);
} });

app.use(express.json({ limit: "256kb" }));
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get(["/client-discovery", "/client-discovery/"], (req, res) => {
  res.redirect(302, retiredPageRedirect(req.originalUrl) || "/?tab=overview");
});
app.use("/api", requireUser);
// Free-only deployment: never invoke metered Gemini services without a separate future authorization.
app.use("/api/ai", (req, res) => { res.status(503).json({ error: apiMessage(req,"aiDisabled") }); });


// AI Sourcing Matrix Evaluation endpoint
app.post("/api/ai/evaluate-matrix", async (req, res) => {
  const { supplierName, responses } = req.body;

  if (!responses) {
    return res.status(400).json({ error: "Missing responses in request body" });
  }

  // Local fallback scoring rules engine if API fails or key is missing
  const localRuleEvaluation = (resp: Record<string, string>): Record<string, number> => {
    const scores: Record<string, number> = {};
    const defaultScore = 50;

    // Helper to extract numeric value from string
    const extractNum = (str: string): number => {
      const val = parseFloat(str.replace(/[^0-9.]/g, ""));
      return isNaN(val) ? 0 : val;
    };

    // 1. Cost and Sampe
    if (resp.fob_cost) {
      const cost = extractNum(resp.fob_cost);
      if (cost <= 20) scores.fob_cost = 90;
      else if (cost <= 25) scores.fob_cost = 80;
      else if (cost <= 30) scores.fob_cost = 70;
      else scores.fob_cost = 50;
    } else scores.fob_cost = defaultScore;

    if (resp.sample_quality) {
      const q = resp.sample_quality.toLowerCase();
      if (q.includes("perfect") || q.includes("excellent")) scores.sample_quality = 100;
      else if (q.includes("good") || q.includes("match")) scores.sample_quality = 90;
      else if (q.includes("wrinkle") || q.includes("average")) scores.sample_quality = 80;
      else if (q.includes("poor")) scores.sample_quality = 50;
      else scores.sample_quality = defaultScore;
    } else scores.sample_quality = defaultScore;

    // 2. Technical & Quality Data
    if (resp.traceability) {
      const t = resp.traceability.toLowerCase();
      scores.traceability = (t === "yes" || t === "true") ? 100 : 0;
    } else scores.traceability = 0;

    if (resp.quality_control) {
      const qc = resp.quality_control.toLowerCase();
      scores.quality_control = (qc === "yes" || qc === "true") ? 100 : 0;
    } else scores.quality_control = 0;

    if (resp.certificates) {
      const cert = resp.certificates.toLowerCase();
      if (cert.includes("certi-pur") && cert.includes("eoko")) scores.certificates = 50; // benchmark check
      else if (cert.includes("iso") || cert.includes("oeko")) scores.certificates = 80;
      else if (cert === "none" || cert === "no") scores.certificates = 0;
      else scores.certificates = defaultScore;
    } else scores.certificates = defaultScore;

    if (resp.warranty_terms) {
      const w = resp.warranty_terms.toLowerCase();
      if (w.includes("3")) scores.warranty_terms = 75;
      else if (w.includes("2")) scores.warranty_terms = 50;
      else if (w.includes("1")) scores.warranty_terms = 25;
      else scores.warranty_terms = defaultScore;
    } else scores.warranty_terms = defaultScore;

    if (resp.audit) {
      const a = resp.audit.toLowerCase();
      scores.audit = (a === "yes" || a === "true") ? 100 : 0;
    } else scores.audit = 0;

    // 3. Commercial Data
    if (resp.import_taxes) {
      const tax = extractNum(resp.import_taxes);
      if (tax <= 12) scores.import_taxes = 70;
      else if (tax <= 15) scores.import_taxes = 50;
      else scores.import_taxes = 40;
    } else scores.import_taxes = defaultScore;

    if (resp.logistic_unit_price) {
      const l = extractNum(resp.logistic_unit_price);
      if (l <= 19) scores.logistic_unit_price = 50;
      else if (l <= 22) scores.logistic_unit_price = 60;
      else scores.logistic_unit_price = 50;
    } else scores.logistic_unit_price = defaultScore;

    if (resp.lead_time) {
      const lt = resp.lead_time.toLowerCase();
      if (lt.includes("35 days")) scores.lead_time = 50;
      else if (lt.includes("30 days")) scores.lead_time = 80;
      else if (lt.includes("21 days")) scores.lead_time = 90;
      else scores.lead_time = defaultScore;
    } else scores.lead_time = defaultScore;

    if (resp.payment_terms) {
      const pt = resp.payment_terms.toLowerCase();
      if (pt.includes("30") && pt.includes("advance") && pt.includes("document")) scores.payment_terms = 50;
      else if (pt.includes("50")) scores.payment_terms = 60;
      else if (pt.includes("cad") || pt.includes("100")) scores.payment_terms = 80;
      else scores.payment_terms = defaultScore;
    } else scores.payment_terms = defaultScore;

    if (resp.monthly_capacity) {
      const cap = resp.monthly_capacity.toLowerCase();
      if (cap.includes("3000")) scores.monthly_capacity = 50;
      else if (cap.includes("5000")) scores.monthly_capacity = 80;
      else if (cap.includes("10000")) scores.monthly_capacity = 100;
      else scores.monthly_capacity = defaultScore;
    } else scores.monthly_capacity = defaultScore;

    // 4. Company Information
    if (resp.average_revenue) {
      const rev = resp.average_revenue.toLowerCase();
      if (rev.includes("less than 1 million")) scores.average_revenue = 25;
      else if (rev.includes("1-5 million")) scores.average_revenue = 50;
      else if (rev.includes("more than 5 million")) scores.average_revenue = 80;
      else scores.average_revenue = defaultScore;
    } else scores.average_revenue = defaultScore;

    if (resp.general_liability) {
      const gl = resp.general_liability.toLowerCase();
      scores.general_liability = (gl === "yes" || gl === "true") ? 100 : 0;
    } else scores.general_liability = 0;

    if (resp.number_of_factories) {
      const num = resp.number_of_factories.toLowerCase();
      if (num.includes("1")) scores.number_of_factories = 25;
      else if (num.includes("2")) scores.number_of_factories = 50;
      else if (num.includes("3")) scores.number_of_factories = 80;
      else scores.number_of_factories = defaultScore;
    } else scores.number_of_factories = defaultScore;

    if (resp.vertical_manufacturing) {
      const vm = resp.vertical_manufacturing.toLowerCase();
      scores.vertical_manufacturing = (vm === "yes" || vm === "true") ? 100 : 0;
    } else scores.vertical_manufacturing = 0;

    if (resp.retailer_experience) {
      const re = resp.retailer_experience.toLowerCase();
      scores.retailer_experience = (re === "yes" || re === "true") ? 100 : 0;
    } else scores.retailer_experience = 0;

    if (resp.other_product_groups) {
      const op = resp.other_product_groups.toLowerCase();
      if (op.includes("garden")) scores.other_product_groups = 25;
      else if (op.includes("textiles")) scores.other_product_groups = 50;
      else if (op.includes("bedsheets")) scores.other_product_groups = 40;
      else scores.other_product_groups = defaultScore;
    } else scores.other_product_groups = defaultScore;

    if (resp.diff_points) {
      scores.diff_points = 60;
    } else scores.diff_points = 0;

    if (resp.diff_point_1) scores.diff_point_1 = 30;
    else scores.diff_point_1 = 0;

    if (resp.diff_point_2) scores.diff_point_2 = 30;
    else scores.diff_point_2 = 0;

    if (resp.diff_point_3) scores.diff_point_3 = 30;
    else scores.diff_point_3 = 0;

    if (resp.diff_point_4) scores.diff_point_4 = 70;
    else scores.diff_point_4 = 0;

    if (resp.diff_point_5) scores.diff_point_5 = 50;
    else scores.diff_point_5 = 0;

    return scores;
  };

  if (!process.env.GEMINI_API_KEY) {
    console.log("No GEMINI_API_KEY configured. Running local deterministic rules engine.");
    const fallbackScores = localRuleEvaluation(responses);
    return res.json({ scores: fallbackScores, source: "local_rules" });
  }

  try {
    const prompt = outputInstruction(req) + `You are a professional B2B Sourcing Evaluator for the Trade2Turkey agency.
Analyze the qualitative and quantitative supplier response inputs provided below, and autonomously score each response from 0 to 100.
Evaluate strictly based on global sourcing best practices, risk levels, certification status, and Trade2Turkey sourcing standards.

SUPPLIER: ${supplierName || "Candidate Supplier"}
RESPONSES JSON MAP:
${JSON.stringify(responses, null, 2)}

SPECIFIC INSTRUCTIONS FOR SCORING:
- "fob_cost": Benchmark is $20.00. Sourcing directly at or below benchmark is excellent (~90+). Higher cost reduces score proportionally.
- "sample_quality": "Perfect Match with Benchmark" -> 100. Slightly flawed -> 80. Average -> 60.
- "traceability": "Yes" -> 100, "No" -> 0.
- "quality_control": "Yes" -> 100, "No" -> 0.
- "certificates": "Certi-pur, Eoko - Tex" is verified but not fully complete -> 50. High tier certifications like ISO + Oeko-Tex -> 80. None -> 0.
- "warranty_terms": "3 Years" -> 75. "2 Years" -> 50. "1 Year" -> 25.
- "audit": "Yes" -> 100, "No" -> 0.
- "import_taxes": lower is better. "15%" -> 50. "12%" -> 70.
- "logistic_unit_price": lower is better. "19" -> 50. "22" -> 60.
- "lead_time": lower is better. "35 days..." -> 50. "30 days" -> 80. "21 days" -> 90.
- "payment_terms": "30% in advance / 70% cash against document" is standard risk -> 50. 100% CAD -> 80.
- "monthly_capacity": "300 sofa" or "3000 sofa" -> 50. Larger is better.
- "average_revenue": "< 1 million USD" -> 25. "1-5 million" -> 50.
- "general_liability": "Yes" -> 100, "No" -> 0.
- "number_of_factories": "1" -> 25. "2" -> 50. "3" -> 80.
- "vertical_manufacturing": "Yes" -> 100, "No" -> 0.
- "retailer_experience": "Yes" -> 100, "No" -> 0.
- "other_product_groups": "Garden Furniture, Mattress" -> 25.
- "diff_points": "Our experience..." -> 60.
- "diff_point_1": "competitive price policy" -> 30.
- "diff_point_2": "R&D" -> 30.
- "diff_point_3": "quick response" -> 30.
- "diff_point_4": "take responsibility..." -> 70.
- "diff_point_5": "empty/none" -> 0.

CRITICAL: Return ONLY a valid JSON object matching the exact keys provided in the Responses input. Do not include markdown code block styling or any explanation text.

Example response:
{
  "fob_cost": 90,
  "sample_quality": 100,
  "traceability": 0
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const cleanedText = response.text.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    const evaluatedScores = JSON.parse(cleanedText);

    res.json({ scores: evaluatedScores, source: "gemini_ai" });
  } catch (error: any) {
    console.error("Gemini Sourcing Matrix Evaluation failed, falling back to rules engine:", error);
    const fallbackScores = localRuleEvaluation(responses);
    res.json({ scores: fallbackScores, source: "fallback_rules", error: error.message });
  }
});

// AI Sourcing Audit endpoint
app.post("/api/ai/audit-rfq", async (req, res) => {
  const { targetSpec, rfq } = req.body;

  if (!targetSpec || !rfq) {
    return res.status(400).json({ error: "Missing targetSpec or rfq payloads" });
  }

  try {
    const prompt = outputInstruction(req) + `You are a professional B2B sourcing auditor and supply chain expert for the Trade2Turkey digital sourcing agency.
Analyze the target specification and the incoming supplier quotations (RFQ submissions) for the product "${targetSpec.productName}" and generate a structured compatibility audit report in clean Markdown.

### TARGET SPECIFICATIONS:
- Category: ${targetSpec.category}
- Dimensions: ${targetSpec.dimensionsWidth}cm x ${targetSpec.dimensionsLength}cm x ${targetSpec.dimensionsHeight}cm
- Cover Material: ${targetSpec.materialCover}
- Filling Material: ${targetSpec.materialFilling}
- Target EXW Price: $${targetSpec.targetExwPrice} USD
- Target FOB Price: $${targetSpec.targetFobPrice} USD
- Target Standards: ${targetSpec.certifiedStandards ? targetSpec.certifiedStandards.join(", ") : "REACH Certified"}
- Packaging Specs: ${targetSpec.packagingDetails}
- Target Notes: ${targetSpec.notes}

### INBOUND SUPPLIER BIDS (RFQ):
${rfq.suppliers.map((sup: any, idx: number) => `
#### Quote #${idx + 1}: ${sup.supplierName} (${sup.location})
- EXW Quote: $${sup.initialQuoteExw} USD
- Lead Time: ${sup.leadTimeDays} Days
- NDA Status: ${sup.hasNda ? "Signed & Valid" : "Pending"}
- Bidder Notes: ${sup.notes}
`).join("\n")}

### AUDIT REPORT REQUIREMENTS:
Write a detailed, executive-ready spec compatibility report.
Structure it with the following sections:
1. **Executive Summary**: A high-level overview of the bids and whether any matches the target.
2. **Quotation Analysis & Financial Comparison**: Compare EXW prices against the target EXW price of $${targetSpec.targetExwPrice} USD, highlighting cost savings or overruns.
3. **SLA & Timeline Feasibility**: Compare lead times against the target requirement.
4. **Risk Assessment & Compliance**: Check for NDA status, certification standards alignment, and potential warning areas (e.g. material substitutions or pending credentials).
5. **Recommendation & Shortlist Advice**: Suggest which manufacturer to proceed with and what negotiation points to raise.

Use bullet points, bold text, and clean formatting. Keep it professional and concise.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    res.json({ auditReport: response.text });
  } catch (error: any) {
    console.error("AI Sourcing Audit failed:", error);
    res.status(500).json({ error: error.message || "Gemini AI audit generation failed" });
  }
});

// AI Sourcing Digest / Summary endpoint
app.post("/api/ai/summarize-report", async (req, res) => {
  const { steps, suppliers, recipes, shipments } = req.body;

  if (!steps || !suppliers || !recipes || !shipments) {
    return res.status(400).json({ error: "Missing steps, suppliers, recipes, or shipments payloads" });
  }

  try {
    const prompt = outputInstruction(req) + `You are a high-level executive B2B sourcing consultant for the Trade2Turkey digital sourcing program.
Summarize the following digital sourcing campaign logs and operations data into a professional, stakeholder-ready executive summary.

### 1. Sourcing SOP Milestones:
- Total SOP steps: ${steps.length}
- Completed steps: ${steps.filter((s: any) => s.status === 'Completed').length}
- In Progress: ${steps.filter((s: any) => s.status === 'In Progress').length}
- Pending: ${steps.filter((s: any) => s.status === 'Pending').length}

### 2. Audited B2B Suppliers:
${suppliers.map((sup: any) => `
- Name: ${sup.name} (${sup.city}, Turkey)
- Verified Status: ${sup.verifiedStatus}
- Quality Score: ${sup.scores.quality}/100 | pricing: ${sup.scores.pricing}/100 | delivery: ${sup.scores.delivery}/100 | communication: ${sup.scores.communication}/100
- Site Audit Completed: ${sup.siteAuditCompleted ? `Yes (${sup.auditScorePercent}% score)` : "No"}
`).join("\n")}

### 3. Grand Bill of Materials (BOM) Recipes:
${recipes.map((rec: any) => `
- Product: ${rec.productName} (${rec.version})
- Materials: ${rec.materials.map((m: any) => `${m.name} (${m.qtyRequired} ${m.unit} @ $${m.unitCostUsd} from ${m.source})`).join(", ")}
- Labor: $${rec.laborCostUsd} | Packaging: $${rec.packagingCostUsd} | Overhead: $${rec.overheadCostUsd}
`).join("\n")}

### 4. Active Vessel Shipments:
${shipments.map((shp: any) => `
- Shipment Code: ${shp.shipmentNumber}
- Product: ${shp.productName}
- Vessel Name: ${shp.vesselName} (Origin: ${shp.originPort} -> Dest: ${shp.destinationPort})
- Current Status: ${shp.status}
- Current Milestone: ${shp.milestones && shp.milestones[shp.currentMilestoneIndex] ? shp.milestones[shp.currentMilestoneIndex].title : "N/A"}
- ETA: ${shp.estimatedArrival}
`).join("\n")}

### STAKEHOLDER DIGEST REQUIREMENTS:
Write an elegant, 3-4 paragraph B2B executive summary.
Focus on:
1. **Pipeline Overview**: Summary of progress along the standard Turkish sourcing SOP stages.
2. **Manufacturing Capacity & Supplier Compliance**: Highlight Bursa/Anatolian factory audit results, quality levels, and compliance posture.
3. **Financial Transparency & COGS Analysis**: Comment on the recipe material cost breakdown, wastage metrics, and efficiency.
4. **Logistics & Delivery Forecast**: Summarize container loading and sea transit ETA milestones.

Write in a formal, encouraging tone suited for B2B executives and trade client partners. Use Markdown formatting.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    res.json({ reportSummary: response.text });
  } catch (error: any) {
  }
});

// AI Sourcing Matchmaker endpoint
app.post("/api/ai/match-manufacturers", async (req, res) => {
  const { competitor, manufacturers } = req.body;

  if (!competitor || !manufacturers) {
    return res.status(400).json({ error: "Missing competitor or manufacturers data" });
  }

  const localMatchFallback = () => {
    const list = manufacturers.map((m: any) => {
      const name = m.name || aiText(req, "manufacturer");
      const certs = (m.vaultDetails?.certifications?.certificates || []).map((c: any) => String(c).toLowerCase());
      const hasBrc = certs.some((c: any) => c.includes("brc") || c.includes("helal") || c.includes("ifs") || c.includes("iso"));
      const price = parseFloat(m.vaultDetails?.pricingCapacity?.exwPriceList) || 0;
      return { name, hasBrc, price };
    });

    const best = list[0] || { name: "Bakker", hasBrc: true, price: 5 };
    return aiText(req, "recommendationReviewValueAsAPotentialManufacturingPartnerFor", best.name);
  };

  if (!process.env.GEMINI_API_KEY) {
    console.log("No GEMINI_API_KEY configured. Running local fallback matcher.");
    const fallbackResult = localMatchFallback();
    return res.json({ recommendation: fallbackResult, source: "local_rules" });
  }

  try {
    const prompt = outputInstruction(req) + `You are a professional B2B digital sourcing matchmaker for Trade2Turkey.
Compare a competitor supermarket product's retail details against a list of verified Turkish manufacturers and suggest which manufacturer is the best fit to exploit this market gap.

COMPETITOR PRODUCT:
- Market/Supermarket: ${competitor.supermarket}
- Brand: ${competitor.brand}
- Shelf Price: $${competitor.shelfPrice}
- Weight: ${competitor.weight} gr
- Product Claims/Tags: ${competitor.claims ? competitor.claims.join(", ") : "None"}

VERIFIED TURKISH MANUFACTURERS FOR THIS PROJECT:
${manufacturers.map((m: any, idx: number) => `
Manufacturer #${idx + 1}: ${m.name}
- Variations: ${m.vaultDetails?.variations ? m.vaultDetails.variations.join(", ") : "N/A"}
- Certifications: ${m.vaultDetails?.certifications?.certificates ? m.vaultDetails.certifications.certificates.join(", ") : "N/A"}
- Pricing/MOQ: EXW Price List: ${m.vaultDetails?.pricingCapacity?.exwPriceList || "N/A"}, MOQ: ${m.vaultDetails?.pricingCapacity?.moq || "N/A"}
- Storage/Shelf Life: Frozen: ${m.vaultDetails?.storageShelfLife?.frozenProducts || "N/A"}, Ambient: ${m.vaultDetails?.storageShelfLife?.ambientProducts || "N/A"}
`).join("\n")}

INSTRUCTIONS:
1. Compare the competitor product (price, claims like Gluten-free, Organic, Vegan, and certifications) with each manufacturer's capabilities.
2. Select the single best manufacturer that can offer a matching or better alternative at a competitive price advantage.
3. Write a single, highly commercial recommendation sentence in the requested output language.
4. Keep it concise, punchy, and direct, matching this style:
"Öneri: Bakker üreticisinin donuk hattı, bu rakibe karşı %22 fiyat avantajı ve gerekli BRC sertifikasına sahip. Bu ürüne odaklanın."

CRITICAL: Return ONLY the recommendation string. Do not include JSON formatting, markdown block indicators, or extra explanations.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    res.json({ recommendation: response.text.trim(), source: "gemini_ai" });
  } catch (error: any) {
    console.error("Gemini Sourcing Matchmaker failed, falling back:", error);
    const fallbackResult = localMatchFallback();
    res.json({ recommendation: fallbackResult, source: "fallback_rules", error: error.message });
  }
});

// AI physical store shelf price search endpoint (Google Search Grounding)
app.post("/api/ai/search-shelf-prices", async (req, res) => {
  const { queryText } = req.body;

  if (!queryText) {
    return res.status(400).json({ error: "Missing queryText payload" });
  }

  const localSearchFallback = (q: string) => {
    const qLower = q.toLowerCase();
    if (qLower.includes("tortilla") || qLower.includes("lavaş") || qLower.includes("unlu")) {
      return [
        {
          supermarket: aiText(req, "tescoMetroPhysicalStore"),
          brand: "Tesco Finest Bakery",
          shelfPrice: 2.10,
          weight: 360,
          claims: [aiText(req, "traditional"), aiText(req, "noAdditives")]
        },
        {
          supermarket: "Sainsbury's Local",
          brand: "Sainsbury's Organic",
          shelfPrice: 2.75,
          weight: 320,
          claims: [aiText(req, "organic"), "Vegan"]
        },
        {
          supermarket: "Marks & Spencer Foodhall",
          brand: "M&S Selection",
          shelfPrice: 3.49,
          weight: 400,
          claims: ["Premium", aiText(req, "highProtein")]
        }
      ];
    } else if (qLower.includes("meyve") || qLower.includes("juice") || qLower.includes("içecek")) {
      return [
        {
          supermarket: aiText(req, "aldiPhysicalStore"),
          brand: "Sun Quench",
          shelfPrice: 1.49,
          weight: 1000,
          claims: [aiText(req, "100Fruit"), aiText(req, "noAddedSugar")]
        },
        {
          supermarket: aiText(req, "lidlPhysicalStore"),
          brand: "Solevita Premium",
          shelfPrice: 1.85,
          weight: 1000,
          claims: [aiText(req, "coldPressed"), aiText(req, "noAdditives")]
        }
      ];
    } else {
      return [
        {
          supermarket: aiText(req, "tescoSuperstorePhysicalStore"),
          brand: "Tesco Value",
          shelfPrice: 1.99,
          weight: 500,
          claims: [aiText(req, "valuePack")]
        }
      ];
    }
  };

  if (!process.env.GEMINI_API_KEY) {
    console.log("No GEMINI_API_KEY configured. Running local fallback search.");
    const fallbackResults = localSearchFallback(queryText);
    return res.json({ results: fallbackResults, source: "local_rules" });
  }

  try {
    const prompt = outputInstruction(req) + `You are a professional FMCG B2B retail market researcher for Trade2Turkey.
Search specifically for in-store physical shelf prices (instore retail prices, physical store pricing, shelf prices) of supermarkets (e.g. Tesco, Sainsbury's, Aldi, Lidl, Walmart, M&S, Costco) for the following query:

QUERY: "${queryText}"

CRITICAL INSTRUCTIONS:
- Do NOT pull online e-commerce delivery prices if they are different from in-store physical retail shelf prices. Focus on in-store, physical retail shelf prices.
- Retrieve 3 to 5 matching products.
- Parse the brand, supermarket name, physical store shelf price (in USD/EUR/GBP, converted to numeric format, e.g. 2.99), package weight in grams, and product claims.
- Return ONLY a valid JSON array of objects with the exact schema:
[
  {
    "supermarket": "Supermarket Name (e.g. Tesco Express)",
    "brand": "Brand Name",
    "shelfPrice": 2.99,
    "weight": 350,
    "claims": ["Claim1", "Claim2"]
  }
]

Do not include markdown formatting or any other explanatory text.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }] // Enable Google Search grounding!
      }
    });

    const cleanedText = response.text.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    const results = JSON.parse(cleanedText);

    res.json({ results, source: "gemini_ai_search" });
  } catch (error: any) {
    console.error("Gemini shelf price search failed, falling back:", error);
    const fallbackResults = localSearchFallback(queryText);
    res.json({ results: fallbackResults, source: "fallback_rules", error: error.message });
  }
});

// 1. Endpoint to generate the Google OAuth URL redirect
app.get("/api/auth/google-url", (req, res) => {
  const client_id = process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID;
  if (!client_id) {
    return res.status(400).json({
      error: "Google Client ID is missing. Please set GOOGLE_CLIENT_ID in your Secrets."
    });
  }

  // Construct redirect URL
  const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
  const redirect_uri = `${appUrl}/auth/callback`;

  const scopes = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
  ].join(" ");

  for (const [key, value] of oauthStates) if (value.expires < Date.now()) oauthStates.delete(key);
  const state = randomBytes(32).toString("hex"), cookie = randomBytes(32).toString("hex");
  oauthStates.set(state, { cookie, uid: res.locals.uid, expires: Date.now() + 10 * 60 * 1000 });
  res.cookie("t2t_oauth", cookie, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600000, path: "/auth/callback" });
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
    client_id,
    redirect_uri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    prompt: "consent",
    state
  }).toString();

  res.json({ url: googleAuthUrl });
});

// 2. Google OAuth Callback Endpoint
app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const candidate = oauthStates.get(state);
  oauthStates.delete(state);
  const cookie = (req.headers.cookie || "").split(";").map(part => part.trim()).find(part => part.startsWith("t2t_oauth="))?.slice(10) || "";
  res.clearCookie("t2t_oauth", { path: "/auth/callback" });
  if (!candidate || candidate.expires < Date.now() || !/^[a-f0-9]{64}$/.test(cookie) || !timingSafeEqual(Buffer.from(cookie), Buffer.from(candidate.cookie))) {
    res.status(400).send("Google bağlantısı doğrulanamadı. Uygulamadan yeniden başlatın."); return;
  }
  const code = req.query.code as string;
  if (!code) {
    return res.send(`
      <html>
        <body>
          <p style="color: red; font-family: sans-serif;">Authentication failed: No code returned from Google.</p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>
    `);
  }

  const client_id = process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID;
  const client_secret = process.env.GOOGLE_CLIENT_SECRET || process.env.CLIENT_SECRET;

  if (!client_id || !client_secret) {
    return res.send(`
      <html>
        <body style="font-family: sans-serif; padding: 20px;">
          <h3 style="color: red;">Configuration Error</h3>
          <p>Google Client ID or Client Secret is missing in the environment setup.</p>
          <p>Please declare <strong>GOOGLE_CLIENT_ID</strong> and <strong>GOOGLE_CLIENT_SECRET</strong> in your AI Studio Settings/Secrets.</p>
          <button onclick="window.close()" style="padding: 8px 16px; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer;">Close Window</button>
        </body>
      </html>
    `);
  }

  try {
    const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
    const redirect_uri = `${appUrl}/auth/callback`;

    // Swap auth code for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id,
        client_secret,
        redirect_uri,
        grant_type: "authorization_code"
      }).toString()
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      throw new Error(tokens.error_description || tokens.error);
    }

    // Retrieve user identity Details
    let email = "Connected User";
    let picture = "";
    if (tokens.access_token) {
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      if (userRes.ok) {
        const userInfo = await userRes.json();
        email = userInfo.email || email;
        picture = userInfo.picture || picture;
      }
    }

    // Success webpage that communicates back using window.opener.postMessage
    const message = JSON.stringify({ type: "OAUTH_AUTH_SUCCESS", firebaseUid: candidate.uid, accessToken: tokens.access_token, email, picture }).replace(/</g, "\\u003c");
    const target = JSON.stringify(appUrl).replace(/</g, "\\u003c");
    res.setHeader("Cache-Control", "no-store");
    res.send(`<html><body><p>Google Drive bağlantısı kuruldu. Bu pencereyi kapatabilirsiniz.</p><script>if(window.opener){window.opener.postMessage(${message},${target});window.close();}</script></body></html>`);

  } catch (error: any) {
    console.error("Token exchange failed:", error);
    res.status(400).send("Google Drive bağlantısı kurulamadı. Uygulamadan tekrar deneyin.");
  }
});

// 3. SECURE PHYSICAL DRIVE UPLOAD (Automatically creates folder structure & shares upload)
app.post("/api/drive/upload", upload.single("file"), async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization token" });
  }

  const accessToken = authHeader.split(" ")[1];
  const file = req.file;
  const { folderName, projectId, stepId } = req.body;
  if (typeof projectId !== "string" || typeof stepId !== "string" || !hasProjectAccess(res.locals.profile, projectId) || projectId.length > 100 || stepId.length > 150 || !/^[a-zA-Z0-9_.-]+$/.test(stepId)) {
    res.status(403).json({ error: "Bu proje / adım için yükleme yetkiniz yok." }); return;
  }

  if (!file) {
    return res.status(400).json({ error: "No physical file was supplied" });
  }

  const cleanFolderName = String(folderName || "SOP Belgeleri").slice(0,200);
  const cleanProjectId = projectId;
  const cleanStepId = stepId;

  try {
    // Standard fetch wrapper for Google Drive queries
    const driveFetch = async (url: string, options: any = {}) => {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...options.headers
        }
      });
      if (!response.ok) {
        const errInfo = await response.json().catch(() => ({}));
        throw new Error(errInfo.error?.message || `Google Drive API error: ${response.status}`);
      }
      return response.json();
    };

    // Helper: Find or Create Folder
    const findOrCreateFolder = async (name: string, parentId?: string): Promise<string> => {
      // Build search query safely
      let q = `mimeType = 'application/vnd.google-apps.folder' and name = '${name.replace(/'/g, "\\'")}' and trashed = false`;
      if (parentId) {
        q += ` and '${parentId}' in parents`;
      } else {
        q += ` and 'root' in parents`;
      }

      console.log(`Searching folder: "${name}" with query: ${q}`);
      const listUrl = `https://www.googleapis.com/drive/v3/files?${new URLSearchParams({ q, fields: "files(id, name)" })}`;
      const listData = await driveFetch(listUrl);

      if (listData.files && listData.files.length > 0) {
        console.log(`Found existing folder "${name}" id: ${listData.files[0].id}`);
        return listData.files[0].id;
      }

      // Not found, create it
      console.log(`Creating folder: "${name}"`);
      const createBody: any = {
        name,
        mimeType: "application/vnd.google-apps.folder"
      };
      if (parentId) {
        createBody.parents = [parentId];
      }

      const createData = await driveFetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createBody)
      });

      return createData.id;
    };

    // Step A: Find/Create "Trade2Turkey Logistics" root workspace
    const rootFolderId = await findOrCreateFolder("Trade2Turkey Logistics");

    // Step B: Find/Create Project-specific subfolder (e.g. "PROJ-BEANBAG (ComfortPro Bean Bags)")
    const projectSubfolderName = cleanProjectId === "PROJ-BEANBAG"
      ? "PROJ-BEANBAG (ComfortPro Bean Bags)"
      : cleanProjectId === "PROJ-VELVET"
        ? "PROJ-VELVET (Luxury Velvet Ottoman)"
        : cleanProjectId;
    const projectFolderId = await findOrCreateFolder(projectSubfolderName, rootFolderId);

    // Step C: Find/Create SOP Task-specific subfolder (e.g. "A.A.1 - Meeting Notes")
    const stepFolderId = await findOrCreateFolder(`${cleanStepId} - ${cleanFolderName}`, projectFolderId);

    // Step D: Physically upload the binary file into the step folder
    console.log(`Uploading file ${file.originalname} into step folder ${stepFolderId}`);

    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: file.originalname,
      parents: [stepFolderId]
    };

    const multipartRequestBody = Buffer.concat([
      Buffer.from(delimiter + "Content-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(metadata)),
      Buffer.from("\r\n" + delimiter + `Content-Type: ${file.mimetype || "application/octet-stream"}\r\n\r\n`),
      file.buffer,
      Buffer.from(closeDelimiter)
    ]);

    const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size,mimeType,createdTime";
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": multipartRequestBody.length.toString()
      },
      body: multipartRequestBody
    });

    if (!uploadRes.ok) {
      const errInfo = await uploadRes.json().catch(() => ({}));
      throw new Error(errInfo.error?.message || `File binary upload failed: ${uploadRes.status}`);
    }

    const fileMeta = await uploadRes.json();
    console.log("Successfully uploaded to Drive. Metadata: ", fileMeta);

    // Files inherit private folder access; no public sharing is created.

    res.json({
      success: true,
      fileId: fileMeta.id,
      fileName: fileMeta.name,
      downloadUrl: fileMeta.webViewLink || `https://drive.google.com/file/d/${fileMeta.id}/view?usp=drivesdk`,
      fileSize: fileMeta.size ? `${(parseInt(fileMeta.size) / (1024 * 1024)).toFixed(2)} MB` : "1.2 MB",
      dateAdded: fileMeta.createdTime ? fileMeta.createdTime.split("T")[0] : new Date().toISOString().split("T")[0]
    });

  } catch (error: any) {
    console.error("Upload handler failed:", error);
    res.status(500).json({ error: error.message || "Unknown error during Drive folder mapping" });
  }
});


app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Request failed:", error.code || error.name);
  res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: error.code === "LIMIT_FILE_SIZE" ? "Dosya en fazla 10 MB olabilir." : "İstek işlenemedi; dosya türü ve alanları kontrol edin." });
});

// 4. Vite Dev Server and Production Fallbacks
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Loaded Vite dev server middleware in Core Context");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api/")) { res.status(404).json({ error: "Servis bulunamadı." }); return; }
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production assets from /dist folder");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Trade2Turkey] Server running on http://localhost:${PORT}`);
  });
}

startServer();
