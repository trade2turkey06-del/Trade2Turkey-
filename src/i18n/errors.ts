// Domain katmanı Türkçe/İngilizce metin yerine bu kodu fırlatır; ekran errorMessage() ile seçili dilde gösterir.
import type { Messages } from "./tr";
export type ErrorCode = keyof Messages["errors"];
export class CodedError extends Error {
  constructor(readonly code: ErrorCode, readonly params: Record<string, string> = {}) { super(code); this.name = "CodedError"; }
}
