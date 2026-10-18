import { sectors } from "./sectors";
import { reports } from "./reports";
import { actionCenter } from "./actionCenter";
import { logistics } from "./logistics";
import { operations } from "./operations";
// Türkçe: tek kaynak. Messages tipi buradan türetilir; en/ aynı tipi eksiksiz karşılamak zorundadır.
// 2. aşamada diğer sekmeler için yeni ad alanları (ör. logistics, overview, reports) buraya eklenir.
import { common, language, login, shell } from "./shell";
import { sourcing, status, steps } from "./sourcing";
import { drive, editors, rfqMatrix } from "./editors";
import { vault } from "./vault";
import { productSpec } from "./productSpec";
import { errors } from "./errors";
import { countries } from "./countries";

export const tr = { sectors, reports, actionCenter, logistics, operations, common, language, shell, login, status, steps, sourcing, editors, rfqMatrix, drive, vault, productSpec, errors, countries };
export type Messages = typeof tr;
