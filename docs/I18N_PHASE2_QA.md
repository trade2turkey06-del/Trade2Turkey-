# Phase 2 language QA

All browser checks use http://localhost:3011 with Firebase emulators (demo-t2t-security), never production writes. User-entered values are preserved. No push or deployment is part of this work.

| Tab | English browser check | Remaining Turkish text | Validation |
| --- | --- | --- | --- |
| Production, Logistics & Inventory | Workflow cards including B.A.7/8/10/12, recurring inventory details, warehouse and procurement forms | Local fixture account name `Yerel Test Yöneticisi` (user data) | TypeScript, 43 unit tests, 25 rules tests, production build passed |

The production workflow uses the approved B.A group title and revised TR/EN KPIs. New operations history stores language-neutral event keys and parameters. Historical free-text notes are preserved.
