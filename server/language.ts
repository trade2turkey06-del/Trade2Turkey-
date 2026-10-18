import { ai as aiTr } from "../src/i18n/tr/ai";
import { ai as aiEn } from "../src/i18n/en/ai";
import type { Request } from 'express';
import { api as tr } from '../src/i18n/tr/api';
import { api as en } from '../src/i18n/en/api';
export function requestLanguage(req: Pick<Request,'body'|'get'>): 'tr'|'en' {
  const value = req.body?.language ?? req.get('X-App-Language');
  return value === 'en' ? 'en' : 'tr';
}
export function apiMessage(req: Pick<Request,'body'|'get'>, key: keyof typeof tr) {
  return (requestLanguage(req) === 'en' ? en : tr)[key];
}
export function outputInstruction(req: Pick<Request,'body'|'get'>) {
  return `OUTPUT LANGUAGE: ${requestLanguage(req) === 'en' ? 'English' : 'Turkish'}. Write all generated explanations, recommendations, headings and descriptive values in this language. Preserve user-provided names and quoted source data. Keep JSON keys, status codes and numeric values unchanged.\n\n`;
}

export function aiText(req: Pick<Request,'body'|'get'>, key: keyof typeof aiTr, ...values: unknown[]) {
  const lang = requestLanguage(req);
  const text = (lang === 'en' ? aiEn : aiTr)[key];
  return text.replace(/\{(\d+)\}/g, (_, index) => {
    const value = values[Number(index)];
    return typeof value === 'number' ? new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'tr-TR',{useGrouping:false,maximumFractionDigits:6}).format(value) : String(value ?? '');
  });
}
