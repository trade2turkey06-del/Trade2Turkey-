# Phase 2 language QA

All browser checks use http://localhost:3011 with Firebase emulators (demo-t2t-security), never production writes. User-entered values are preserved. No push or deployment is part of this work.

| Tab | English browser check | Remaining Turkish text | Validation |
| --- | --- | --- | --- |
| Production, Logistics & Inventory | Workflow cards including B.A.7/8/10/12, recurring inventory details, warehouse and procurement forms | Local fixture account name `Yerel Test Yöneticisi` (user data) | TypeScript, 43 unit tests, 25 rules tests, production build passed |

The production workflow uses the approved B.A group title and revised TR/EN KPIs. New operations history stores language-neutral event keys and parameters. Historical free-text notes are preserved.

| Action Center | Summary, user access controls and backup/restore controls opened in English | `Yerel Test Projesi` (project name); fixture account names (user data) | TypeScript, 44 unit tests, 25 rules tests and build passed |

Read-only live enum scan is retained in `I18N_PHASE2_STATUS_SCAN.json`. Missing fields are reported separately from unknown populated values. No migration writes were performed. The local UI seed can be rerun after destructive emulator rule tests.

| Reports | English report summary and print/PDF, text download and email-draft controls inspected | Project name only (user data) | TypeScript, 45 unit tests, 25 rules tests and build passed |

Report display, text download and email draft share the same localised summary. Browser download-event capture timed out; no downloaded-file verification is claimed. Print/PDF uses the same rendered report; the operating-system print dialog is not translated by the application.

| Sectors | Sector navigation, company card and Add company form inspected in English | Stored sector `Havlu`; company location, products, profile text and contact `Şenay Karakozak` remain unchanged | TypeScript, 45 unit tests, 25 rules tests and build passed |
