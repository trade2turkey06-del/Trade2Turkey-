import { buyers } from "./buyers";
import { ai } from "./ai";
import { market } from "./market";
import { workspaceAdmin } from "./workspaceAdmin";
import { api } from "./api";
import { discovery } from "./discovery";
import { sectors } from "./sectors";
import { actionCenter } from "./actionCenter";
import { logistics } from "./logistics";
import { operations } from "./operations";
// Türkçe: tek kaynak. Messages tipi buradan türetilir; en/ aynı tipi eksiksiz karşılamak zorundadır.
// 2. aşamada diğer sekmeler için yeni ad alanları (ör. logistics, overview) buraya eklenir.
import { common, language, login, shell } from "./shell";
import { sourcing, status, steps } from "./sourcing";
import { bom, cogs, drive, editors, rfqMatrix } from "./editors";
import { vault } from "./vault";
import { productSpec } from "./productSpec";
import { errors } from "./errors";
import { countries } from "./countries";

export const tr = { buyers, ai, market, workspaceAdmin, api, discovery, sectors, actionCenter, logistics, operations, common, language, shell, login, status, steps, sourcing, editors, rfqMatrix, cogs, bom, drive, vault, productSpec, errors, countries };
export type Messages = typeof tr;
