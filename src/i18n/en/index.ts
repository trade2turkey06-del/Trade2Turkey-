import { buyers } from "./buyers";
import { ai } from "./ai";
import { market } from "./market";
import { api } from "./api";
import { discovery } from "./discovery";
import { sectors } from "./sectors";
import { actionCenter } from "./actionCenter";
import { logistics } from "./logistics";
import { operations } from "./operations";
// English: must satisfy the Turkish Messages type exactly, so a missing key fails type-checking.
import type { Messages } from "../tr";
import { common, language, login, shell } from "./shell";
import { sourcing, status, steps } from "./sourcing";
import { bom, cogs, drive, editors, rfqMatrix } from "./editors";
import { vault } from "./vault";
import { productSpec } from "./productSpec";
import { errors } from "./errors";
import { countries } from "./countries";

export const en: Messages = { buyers, ai, market, api, discovery, sectors, actionCenter, logistics, operations, common, language, shell, login, status, steps, sourcing, editors, rfqMatrix, cogs, bom, drive, vault, productSpec, errors, countries };
