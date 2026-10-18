# Phase 2 language QA

All browser checks used http://localhost:3011 and Firebase emulators (`demo-t2t-security`). No production writes, paid AI calls, rule deployment, push or application deployment were performed.

| Tab | English browser coverage | Remaining Turkish text | Passed checks at tab completion |
| --- | --- | --- | --- |
| Production, Logistics & Inventory | Workflow cards including B.A.7/8/10/12, recurring inventory details, warehouse and procurement forms | Fixture account name `Yerel Test Yöneticisi` (user data) | TypeScript, 43 unit tests, 25 rules tests, build |
| Action Center | Summary, user access controls and backup/restore controls | Fixture project and account names (user data) | TypeScript, 44 unit tests, 25 rules tests, build |
| Reports | Summary and print/PDF, text download and email-draft controls | Fixture project name (user data) | TypeScript, 45 unit tests, 25 rules tests, build |
| Sectors | Sector navigation, company card and Add company form | Stored sector `Havlu`; company location, products, profile and contact `Şenay Karakozak` (stored data) | TypeScript, 45 unit tests, 25 rules tests, build |
| Client Discovery | Legacy lead expanded, Add lead form, filters and shared client workspace controls | Fixture company/person/job title and `Kullanıcı notu: değiştirilmeden korunmalı.` (user data) | TypeScript, 46 unit tests, 25 rules tests, build |
| Market Research | Legacy benchmark, research panel, unit cost calculator with DDP/EXW views | `Örnek Market`, `Türkçe Marka`, `Şekersiz` (user data); no Turkish application text in cost calculator | TypeScript, 49 unit tests, 25 rules tests, build |

## Behaviour verified

- Approved B.A group title and revised TR/EN KPIs are present. B.A.7 concerns raw materials only; B.A.8 concerns packaging receipt and approval.
- New operations history stores keys and parameters. User notes and historical records are preserved.
- Both lead writers use canonical pipeline status keys; legacy TR/EN labels are normalised on read. Company-type and urgency choices write stable keys. Missing and unknown stored values are not guessed.
- The read-only live enum scan is retained in `I18N_PHASE2_STATUS_SCAN.json`. No migration writes were performed.
- AI requests carry `language`. All six server prompts receive a request-local language instruction; generated local fallback prose also uses the selected language. The global AI 503 gate remains enabled and is regression-tested.
- An existing benchmark with stored `%30 Daha Ucuz` renders as `30% lower` in English, recalculated from prices. New benchmark writes use numeric percentage and direction keys.
- Report display, text download and email draft share one localised summary. Browser download-event capture timed out, but the resulting `~/Downloads/DEMO-report.txt` was subsequently found and its English contents verified directly. Print/PDF uses the same rendered report; an exported PDF was not separately rendered for inspection.
- Shared error messages and remaining client-workspace/freelancer controls were included in the final source audit. Unused built-in sample lead constants were removed; persisted company records were not changed.
- The local UI seed is repeatable after rule tests clear emulator data.

## Live scan (18 October 2026, 21:10 Istanbul)

| Field | Stored value | Documents | Canonical key |
| --- | --- | ---: | --- |
| users.status | missing | 6 | No automatic default proposed |
| users.status | active | 2 | active |
| users.status | Aktif | 1 | active |
| leads.status | Devam Ediyor | 3 | in_progress |
| leads.companyType | missing | 2 | No automatic default proposed |
| leads.companyType | Distribütör | 1 | distributor |
| leads.urgency | missing | 2 | No automatic default proposed |
| leads.urgency | 1-3 Ay İçinde | 1 | within_1_3_months |

Nine user documents and three lead documents were inspected. Unknown populated values: none. A fresh checksum-verified backup and separate user approval are required before any production migration writes.
