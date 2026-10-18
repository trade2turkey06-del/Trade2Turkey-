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
