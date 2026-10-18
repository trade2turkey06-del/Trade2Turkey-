# High-Protein Tortilla sample project

This is a fictional **sample project**, never a live customer project. All commercial figures, companies, evidence names, certifications, approvals and history are simulated. PDF names are placeholders, not uploaded documents or genuine certificates. Reserved `example.invalid` evidence links deliberately do not resolve. Manufacturer names include “Sample” to reduce confusion; no trademark clearance is claimed.

Project ID: `DEMO-HIGH-PROTEIN-TORTILLA`  
Name: **DEMO – High-Protein Tortilla (Sample Project)**

## Access

The existing Firestore rules permit all active, authenticated administrators/owners to read every project. Clients and freelancers require a project assignment. The scripts do not add any user, authentication account or assignment, and refuse to operate if a user is already assigned to this sample project. Therefore all administrators can see it, and other roles cannot. This is the access policy explicitly selected for the sample. No security rules are changed.

The responsible person is a fictional display identity, not a login. The small workflow UI fallback displays this name without creating a shared user profile. Historical events and specification signatures explicitly identify fictional people. `SAMPLE_OWNER_UID` supplies an existing administrator for approval handling; scripts do not modify that account.

## Run and inspect locally

Requires Node dependencies and Java 21+. Use the configured Firestore/Auth emulators:

```sh
npx -y firebase-tools@latest emulators:exec --only firestore,auth --config firebase.test.json --project demo-t2t-security 'npx tsx scripts/sample-project/verify.ts'
```

The verification creates the sample, checks domain calculations and actual client security-rule access, rejects a duplicate seed, rejects remote emulator addresses and unapproved live mode, deletes the sample plus later UI-created linked records, checks unrelated data survives, then reseeds it. `emulators:exec` discards that session when it exits. For ongoing UI inspection, start the emulators instead, set the following variables in another terminal, and seed:

```sh
npx -y firebase-tools@latest emulators:start --only firestore,auth --config firebase.test.json --project demo-t2t-security
```

```sh
export GCLOUD_PROJECT=demo-t2t-security
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8085
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9098
npx tsx scripts/sample-project/seed.ts
```

For UI login, use the repository's `tests/ui-seed.mjs` in this emulator session, set `SAMPLE_OWNER_UID` to that emulator administrator's UID before seeding, and open the development app with `VITE_USE_EMULATORS=true PORT=3011 npm run dev`. Select English in the interface. The demo itself does not create login accounts.

Remove all linked sample data with one command in the same environment:

```sh
npx tsx scripts/sample-project/cleanup.ts
```

## Presentation snapshot

- Three fully populated fictional manufacturer vaults; English content and sample PDF names.
- A.A.1–A.A.7 and A.B.1–A.B.8 approved: 15 of 21 sourcing steps.
- A.B.9 pending approval, with 12 EUR cost lines imported using the application's own `costLinesFromSpec` function.
- A.B.10 in progress; four later steps not started. Logistics has no records and displays its normal initial state.
- RFQ matrix with three offers and complete scores; Northfield Sample Bakeworks Ltd. ranks first and is selected in A.B.7.
- Approved v1.0, 100% formulation, two fictional signatures, golden sample code, nutrition, microbiology, packaging and storage.
- Protein energy contribution 30.4%; salt 1.96 g/100 g → High under the application's default illustrative thresholds. Claims use the existing UI calculator; shared claim-threshold records are never modified. If live thresholds differ, review the resulting live claim panel.
- 49 explicitly simulated workflow events, including starts, submissions and decisions.

**Workflow exception:** the requested A.B.10 in-progress state while A.B.9 awaits approval cannot be produced through the normal application flow. The administrative seed creates a presentation snapshot and labels this exception in the A.B.10 notes. The UI continues to show the prerequisite warning. To demonstrate a valid transition, approve A.B.9 first. No workflow dependency or rule has been weakened.

## Live procedure — requires a separate approval

The implementation is prepared; live mutation has not been authorized. Obtain explicit user approval after reviewing emulator results and the backup. Do not infer approval from running the local scripts.

Before writing, take a fresh, read-only backup and retain its printed path/checksum:

```sh
node scripts/project-backup.mjs
```

Live runtime is pinned to `planar-folio-h6m9v`, database `ai-studio-dc5b1b9e-d9cc-4460-9a0c-a0260ae0cfa7` (Enterprise / native mode). It requires a complete backup with deployed rules, matching SHA-256 and creation time within the last hour, an active existing administrator UID, and the explicit approval gate. Refresh the existing Firebase CLI token with a read-only database inspection if necessary. Credentials are never printed or included in seed data.

Only **after** user approval, remove emulator variables, set `SAMPLE_OWNER_UID`, `SAMPLE_BACKUP_DIR` and `SAMPLE_LIVE_APPROVAL=APPROVED:DEMO-HIGH-PROTEIN-TORTILLA`, then run:

```sh
npx tsx scripts/sample-project/seed.ts --live
```

The same backup and approval gates apply to live cleanup:

```sh
npx tsx scripts/sample-project/cleanup.ts --live
```

Creation uses one atomic, create-only batch and refuses existing project data, orphaned child collections or linked root documents. Reruns stop rather than overwrite. Cleanup requires the exact root marker, discovers all nested project data and all root documents linked by `projectId`, and atomically deletes only those records with update-time preconditions. It stops if users are assigned, or the data exceeds the 500-document atomic limit. It does not delete or change any user. Pause editing the sample while cleaning it up. Existing projects remain outside both scripts' write scope.

The read-only backup is a document export with a verified checksum, not a point-in-time database snapshot. Keep normal production backup practices in place. No Render deployment or push is part of these scripts.

## Verification record (18 October 2026)

- `npm run check`: TypeScript, 41 existing tests and production build passed.
- Local Firestore/Auth lifecycle verification passed: 75 sample documents; 15 approved, 1 pending approval, 1 in progress, 4 not started; 100% formulation; protein energy 30.4%; salt High; Northfield ranks first.
- Both tested administrators could read; every generated document was denied to unassigned clients, freelancers and anonymous sessions.
- A repeated seed stopped without modifying the project. Non-local emulator hosts and unapproved live mode were rejected.
- Cleanup removed 77 records including two subsequently created linked records. The unrelated project and all four verification user profiles survived. Reseeding after cleanup succeeded.
- Read-only live backup taken at 13:45 Istanbul time: 184 documents, 7 account identifiers and deployed rules; SHA-256 verified. Export is retained under the ignored `backups/` directory. Refresh before live mutation if older than one hour.
- No production data writes, rules deployment or Git push performed.
