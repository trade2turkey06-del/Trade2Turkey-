// Print and CSV export shared by the sheet editors (A.B.5 COGS sheet, A.B.6 RFQ matrix).
// Print only the sheet, landscape; the rest of the page is hidden while printing. Elements marked rfq-no-print are hidden,
// rfq-print-text shows a form control's value as wrapping text and rfq-scroll stops clipping wide tables.
export const sheetPrintCss = (rootId: string, bodyClass: string) => {
  const root = `body.${bodyClass} #${rootId}`;
  return `@media print {
  body.${bodyClass} * { visibility: hidden !important; }
  ${root}, ${root} * { visibility: visible !important; }
  ${root} { position: absolute; left: 0; top: 0; width: 100%; border: 0; }
  ${root} .rfq-no-print { display: none !important; }
  ${root} .rfq-scroll { overflow: visible !important; }
  ${root} tr { break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* Form controls cannot wrap text, so print shows their values as wrapping text instead. */
  ${root} input, ${root} select, ${root} textarea { display: none !important; }
  ${root} .rfq-print-text { display: block !important; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
  ${root} table { table-layout: fixed; width: 100%; }
  ${root} th, ${root} td { position: static !important; min-width: 0 !important; overflow-wrap: anywhere; }
  @page { size: landscape; margin: 8mm; }
}
#${rootId} .rfq-print-text { display: none; }`;
};
export function printSheet(bodyClass: string) {
  document.body.classList.add(bodyClass);
  const done = () => { document.body.classList.remove(bodyClass); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  window.print();
}
// UTF-8 BOM so Excel opens Turkish characters correctly.
export function downloadCsv(prefix: string, title: string, csv: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `${prefix}-${(title || "export").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.csv` });
  link.click(); URL.revokeObjectURL(url);
}
