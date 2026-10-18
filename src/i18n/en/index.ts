// English: must satisfy the Turkish Messages type exactly, so a missing key fails type-checking.
import type { Messages } from "../tr";
import { common, language, login, shell } from "./shell";
import { sourcing, status, steps } from "./sourcing";
import { drive, editors, rfqMatrix } from "./editors";
import { vault } from "./vault";
import { productSpec } from "./productSpec";
import { errors } from "./errors";

export const en: Messages = { common, language, shell, login, status, steps, sourcing, editors, rfqMatrix, drive, vault, productSpec, errors };
