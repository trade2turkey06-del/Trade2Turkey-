# Phase 2 language QA

All browser checks used http://localhost:3011 and Firebase emulators (`demo-t2t-security`). No production writes, paid AI calls, rule deployment, push or application deployment were performed.

| Tab | English browser coverage | Remaining Turkish text | Passed checks at tab completion |
| --- | --- | --- | --- |
| Production, Logistics & Inventory | Workflow cards including B.A.7/8/10/12, recurring inventory details, warehouse and procurement forms | Fixture account name `Yerel Test Yöneticisi` (user data) | TypeScript, 43 unit tests, 25 rules tests, build |
| Action Center | Summary, user access controls and backup/restore controls | Fixture project and account names (user data) | TypeScript, 44 unit tests, 25 rules tests, build |
| Reports | Summary and print/PDF, text download and email-draft controls | Fixture project name (user data) | TypeScript, 45 unit tests, 25 rules tests, build |
| Sectors | Sector navigation, company card and Add company form | Stored sector `Havlu`; company location, products, profile and contact `Şenay Karakozak` (stored data) | TypeScript, 45 unit tests, 25 rules tests, build |
| Market Research | Legacy benchmark, research panel, unit cost calculator with DDP/EXW views | `Örnek Market`, `Türkçe Marka`, `Şekersiz` (user data); no Turkish application text in cost calculator | TypeScript, 49 unit tests, 25 rules tests, build |

## Behaviour verified

- Approved B.A group title and revised TR/EN KPIs are present. B.A.7 concerns raw materials only; B.A.8 concerns packaging receipt and approval.
- New operations history stores keys and parameters. User notes and historical records are preserved.
- The freelancer lead writer uses canonical pipeline status keys; legacy TR/EN labels are normalised on read. Company-type and urgency choices write stable keys. Missing and unknown stored values are not guessed.
- The read-only live enum scan is retained in `I18N_PHASE2_STATUS_SCAN.json`. No migration writes were performed.
- AI requests carry `language`. All five remaining server prompts receive a request-local language instruction; generated local fallback prose also uses the selected language. The global AI 503 gate remains enabled and is regression-tested.
- An existing benchmark with stored `%30 Daha Ucuz` renders as `30% lower` in English, recalculated from prices. New benchmark writes use numeric percentage and direction keys.
- Report display, text download and email draft share one localised summary. Browser download-event capture timed out, but the resulting `~/Downloads/DEMO-report.txt` was subsequently found and its English contents verified directly. Print/PDF uses the same rendered report; an exported PDF was not separately rendered for inspection.
- Shared error messages and freelancer controls were included in the final source audit. Unused built-in sample lead constants were removed; persisted company records were not changed.
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

## 21 October 2026 removal verification

The retired admin workspace/lead screen, scouter management views, freelancer audit overlay and lead-evaluation API implementation were removed with approval. The shared freelancer labels and legacy lead data remain; account invitations and password setup still belong to Action Center user management. No live data, authentication accounts, security rules or Drive folders were changed.

- Lint, explicit TypeScript check, 78 application tests and production build passed.
- All 35 security rules tests passed in local emulators. Additional synthetic admin/client/freelancer sign-in, profile access, assigned-project access and sign-out checks passed against the Auth/Firestore emulators; unauthorized cross-project access was rejected.
- Server-rendered TR/EN navigation checks cover all six remaining admin pages, project selector, project names, new-project control, language controls and logout. Client navigation retains its existing role restrictions.
- The local production server returned dashboard redirects for retired paths and served the remaining SPA entry points. These checks do not claim a full interactive browser walkthrough of every page.
- Twenty-three shared files, including login, invitations, user management, access rules, page implementations, language provider and Drive services, were verified byte-for-byte unchanged. App authentication, project-list/project-creation code and the shared server upload implementation were also compared with the pre-removal version.
- Final term search retains compatibility redirect code/tests, unrelated operations synchronization text and the agreed historical development archive only.
- Existing user activity/profile fields were preserved. No migration was run. Deploy the updated application through the normal Render workflow when ready; no Drive cleanup or database migration is required for this removal.
