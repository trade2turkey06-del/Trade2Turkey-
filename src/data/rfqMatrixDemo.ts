import { applySuggestions, createMatrix, type Criterion, type RfqMatrix } from "../domain/rfqMatrix";

// Fictional demo data (flagged isDemo) so totals and "Recommended" can be seen working. No real company names.
// Each row: [criterion label override or null, [value, score] for each of the three demo manufacturers].
type Row = [string | null, [string, number?], [string, number?], [string, number?]];
const offer: Row[] = [
  [null, ["4.10 USD"], ["3.65 USD"], ["4.80 USD"]],
  [null, ["Soft hand-feel, even loops", 4], ["Slight shedding after wash", 3], ["Dense pile, excellent absorbency", 5]],
  [null, ["100% combed cotton, Ne 16/1", 4], ["100% carded cotton, Ne 20/1", 3], ["100% Aegean cotton, Ne 16/1 combed", 5]],
  [null, ["Polyester sewing thread", 4], ["Polyester sewing thread", 4], ["Cotton sewing thread", 5]],
  ["Dobby Border", ["Woven dobby border", 4], ["Plain border", 3], ["Jacquard dobby border", 5]],
  ["Hanging Loop", ["Yes, 6 cm", 4], ["No", 2], ["Yes, 6 cm", 4]],
  ["Care Label", ["Printed satin label", 4], ["Printed label", 3], ["Woven label", 5]],
  ["Packaging", ["Polybag + header card", 4], ["Polybag", 3], ["Belly band + polybag", 5]],
  ["Colour Fastness", ["Grade 4", 4], ["Grade 3-4", 3], ["Grade 4-5", 5]],
];
const sections: Record<string, Row[]> = {
  technical: [
    [null, ["In-house lab, AQL 2.5", 4], ["Final inspection only", 2], ["In-house lab + third-party AQL 2.5", 5]],
    [null, ["OEKO-TEX + BSCI", 4], ["OEKO-TEX", 3], ["OEKO-TEX + GOTS + SEDEX", 5]],
    [null, ["Replacement of defective goods within 90 days", 4], ["Credit note only", 2], ["Replacement within 180 days", 5]],
    [null, ["BSCI audit 2025 (B rating)", 4], ["No social audit", 1], ["SMETA 4-pillar 2025", 5]],
  ],
  commercial: [
    [null, ["0% UK duty with origin proof", 4], ["0% UK duty with origin proof", 4], ["0% UK duty with origin proof", 4]],
    [null, ["12.50 USD"], ["11.00 USD"], ["13.20 USD"]],
    [null, ["45 days"], ["60 days"], ["35 days"]],
    [null, ["30% deposit + 70% before loading", 3], ["30% deposit + 70% against BL copy", 4], ["50% deposit + 50% before loading", 2]],
    [null, ["80k pcs"], ["40k pcs"], ["120k pcs"]],
  ],
  company: [
    [null, ["22 years"], ["9 years"], ["35 years"]],
    [null, ["250", 3], ["90", 2], ["600", 5]],
    [null, ["USD 12M", 3], ["USD 4M", 2], ["USD 30M", 5]],
    [null, ["USD 1M product liability", 4], ["None", 1], ["USD 2M product liability", 5]],
    [null, ["1", 3], ["1", 3], ["3", 5]],
    [null, ["Weaving + dyeing", 4], ["Weaving only", 2], ["Spinning to packing", 5]],
    [null, ["Two EU retailers", 4], ["None", 1], ["UK & US department stores", 5]],
    [null, ["Bathrobes, beach towels", 4], ["Kitchen textiles", 3], ["Bathrobes, bedding, spa", 5]],
    [null, ["Fast sampling (7 days)", 4], ["Lowest price", 4], ["Own spinning mill", 5]],
    [null, ["Low MOQ 1,000 pcs", 4], ["Flexible colours", 3], ["GOTS organic line", 5]],
    [null, ["In-house embroidery", 4], ["Family owned", 2], ["Retail-ready packaging", 5]],
    [null, ["Sustainability report", 3], ["Close to Izmir port", 3], ["Dedicated UK account manager", 5]],
    [null, ["Digital order tracking", 3], [""], ["Solar-powered plant", 4]],
  ],
  soft: [
    [null, ["Replies within 24 h", 4], ["Replies within 3 days", 2], ["Same-day replies", 5]],
    [null, ["Good", 4], ["Basic", 2], ["Fluent", 5]],
    [null, ["Accepts small changes", 4], ["Limited", 2], ["Very flexible", 4]],
  ],
};

export function createDemoMatrix(): RfqMatrix {
  const matrix = createMatrix("Hotel-grade bath towel 600 GSM, 70x140 cm – UK brand, 3,000 pcs");
  const names = ["Denizli Textile Co. (demo)", "Usak Home Linen (demo)", "Bursa Terry Mills (demo)"];
  const manufacturers = matrix.manufacturers.map((manufacturer, index) => ({ ...manufacturer, name: names[index] }));
  const ids = manufacturers.map(manufacturer => manufacturer.id);
  const fill = (criteria: Criterion[], rows: Row[]) => criteria.map((item, index) => {
    const [label, ...cells] = rows[index];
    const values: Record<string, string> = {}, scores: Record<string, number> = {};
    cells.forEach(([value, score], column) => { if (value) values[ids[column]] = value; if (score) scores[ids[column]] = score; });
    return { ...item, label: label ?? item.label, values, scores };
  });
  // Numeric rows (prices, lead time, capacity, years) are left unscored and receive the suggested scores.
  return applySuggestions({
    ...matrix, isDemo: true, manufacturers,
    items: matrix.items.map(item => ({ ...item, name: "Bath towel 600 GSM, 70x140 cm", criteria: fill(item.criteria, offer),
      notes: { [ids[0]]: "Good balance of price and quality.", [ids[1]]: "Cheapest offer; check shedding on bulk.", [ids[2]]: "Premium quality; price above the other offers." } })),
    sections: matrix.sections.map(section => section.id === "offer" ? section : { ...section, criteria: fill(section.criteria, sections[section.id]) }),
  });
}
