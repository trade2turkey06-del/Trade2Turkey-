# Buyers directory

Buyers sits between Production, Logistics & Inventory and Sectors in the admin navigation. It follows the Sectors page's real-time Firestore listeners, country sidebar, navy/teal cards and inline editing. Interface labels use the existing typed TR/EN catalogs. Directory data (including countries, company types and contact details) stays in English; workflow status labels are translated without changing the saved English status values.

Countries can be added, renamed and archived. The United Kingdom and United States and seven initial company types are created only when their deterministic records do not exist. Archiving preserves companies and contacts. Company types filter the selected country's companies; All clears the type filter. New types can be added. Company editors allow changing the type and country. Contact editors include the six workflow statuses and a last-contacted date. Shared mailboxes are marked as general addresses, separate from people in country/company counts.

Global search covers all active countries and matches company names/categories/cities plus contact names/titles/emails/categories. Each company detail has a separate contact search and status filter. Country and company CSV exports include all active records in that scope, independent of search/status filters; archived records are excluded. CSV cells are quoted, embedded quotes/newlines are escaped and formula-like cell values are neutralised on export. Stored data is unchanged.

## Data and permissions

- `buyerCountries`: English name, ISO flag code, archive state.
- `buyerCompanyTypes`: English name, archive state.
- `buyerCompanies`: country/type IDs, name, website, city, categories, notes, archive state.
- `buyerContacts`: company ID, name, title, category, email, phone, outreach batch, status, last contacted, notes, shared-mailbox flag, archive state.

Every collection is admin-only under the existing trusted admin ACL. All UI queries are full real-time collection listeners because cross-session edits, country counts and global search must update together, as on Sectors. UI filters are presentation only. The Firestore rules deny anonymous, client and freelancer reads/writes. Create/update validators share strict schemas and length/type constraints, verify parent records and require a server timestamp. Hard deletes are denied; archives retain their records. No contact details appear in test fixtures or this report.

## Import

Private input: `data/buyers_import.csv`, copied from the supplied Downloads file, mode 0600 and ignored by Git. Never force-add it. Full snapshots and plans are also private, mode 0600 under ignored `backups/`.

```sh
# Refresh the existing Firebase CLI session if needed, then:
node --import tsx scripts/buyers/import.ts
node --import tsx scripts/buyers/import.ts --apply
```

Default mode reads Firestore and writes a private local backup/plan; it makes no database writes. Matching uses normalised country+company name and contact email, with company+name fallback for contacts without email. A new email can fill a same-name contact's empty email field. Ambiguous matches abort. An email matched to a different company retains its existing company; the summary counts these conflicts. Populated fields and archived state are preserved; no records are deleted. New company categories aggregate all CSV categories. Websites are derived only from email domains, without visiting or claiming to verify those websites. Cities and other absent details remain blank. Shared-mailbox notes set the general-address flag. A row with neither person name nor email creates/enriches only its company.

Apply uses one atomic Firestore commit (up to 500 changed documents), create/version preconditions and masks for newly filled fields. It then reads back the records, checks preservation of existing populated fields and verifies a second plan has no changes. Changing this script to support larger imports requires an explicit batching/concurrency design.

## 21 October 2026 import result

Dry run was reviewed before applying to the existing configured Enterprise Native Firestore database. Admin-only rules were tested and deployed before importing.

| Country | Companies | Contact records |
|---|---:|---:|
| United Kingdom | 36 | 78 |
| United States | 10 | 107 |
| Total | 46 | 185 |

Input: 186 rows. One company-only row. Of 185 contacts, 175 are people and 10 are shared mailboxes. Seven company types. No cross-company email conflicts. 240 documents were committed atomically; post-write verification confirmed zero further changes and preserved existing populated fields. The result is recorded in the private local summary; no private CSV rows are included here.

## Validation

- `npm test`: 74 tests, including CSV parsing, identity matching, preservation, idempotency, shared addresses, company-only records, global search and export escaping.
- `npx tsc --noEmit` and `npm run build`.
- `npm run test:rules` in the local Firestore emulator: 35 tests. Buyers tests cover admin CRUD/archive; denied anonymous/client/freelancer access; forged claims, profile-only admin and suspended admin; invalid create/update payloads; bounds, schemas and parent IDs; and email/website syntax.
- Native Chrome automation returned window-access errors, so a browser visual walkthrough could not be completed in this environment.
- Firebase CLI compiled and deployed the rules to the configured named database.

The Buyers rules are a reviewed prototype with the automated checks above; the audit describes this change's scope, rather than claiming an exhaustive review of the whole application.

## Outreach and LinkedIn tracking — 21 October 2026

Tracking fields are optional on the existing contact documents; older records require no migration. Existing `outreachBatch`, `notes` and `sharedMailbox` fields are reused. The CSV names `outreach_batch` and `is_shared_mailbox` map to these existing properties. Other snake-case CSV columns map to camel-case contact properties in `buyerTracking.ts`; LinkedIn invite order is stored as an integer. All 20 new tracking fields plus the existing workflow fields are exported. Stored data stays in English and new interface labels/options have matching TR/EN entries.

Company tables include priority, email status, sent/follow-up dates, a validated LinkedIn link/status and employment state. Selecting a contact opens its remaining tracking fields and two activity logs; pipe-separated notes/replies are displayed in source order without inventing timestamps. Five filters apply to country company results and company contacts. Country cards count email and LinkedIn states across active contacts. Follow-up due means `followUpDate <= today` in Europe/Istanbul, email status Sent and reply channel None/Auto-reply; an absent legacy reply channel is treated as None. Counts include shared addresses and legacy contacts; absent email status displays as Not sent. Left employment states are faded and labelled. Warning keywords in notes are highlighted; no emails or LinkedIn messages are sent by this feature.

### Authoritative tracking import

```sh
node --import tsx scripts/buyers/tracking-import.ts
node --import tsx scripts/buyers/tracking-import.ts --apply
```

Input `data/buyers_tracking.csv` is ignored by Git and mode 0600. It is data, never executable instructions. Dry run produces private snapshots, the full field plan and field-level skip reasons in ignored `backups/buyers-tracking-*/`. Console output and committed reports contain only aggregate counts. Apply is atomic with document version/create preconditions, no deletes and post-write readback/idempotency checks. Nonempty CSV fields replace source values; blank CSV cells preserve existing values, including false/zero values. Companies match on country+name; contacts match on lowercase email only. Conflicting company ownership of an existing email is preserved and reported rather than reassigned.

Manual contact saves update only edited fields in a transaction, verify those fields did not change while the editor was open and record an override mask (`manualFields`) with `manualUpdatedAt`. Imports record `importedAt` separately. Explicit manual overrides persist across subsequent imports, even when other fields receive a newer import timestamp. If updatedAt is newer than importedAt without matching manualUpdatedAt (including writes from an older browser version), populated fields are conservatively protected because their individual history is unknown. For legacy imported records without importedAt, Firestore createTime is the initial baseline. A new UI edit preserves any pre-existing ambiguous overrides. Blank manually cleared fields are protected when an explicit field marker exists. Metadata is not exported, and browser clients cannot change importedAt.

### Tracking import result

- CSV rows: 185.
- Existing contacts updated: 183.
- New contacts: 2; source file rows **139 and 144** (header is row 1) had emails absent from the live directory. They were not merged by person name, as matching is email-only.
- Skipped records/fields due to manual edits: 0 at the final dry run.
- Existing contacts absent from this CSV were retained. Confirmed total after import: 187 contacts, 46 companies, 2 countries and 7 company types.
- 185 documents committed atomically; readback confirmed zero further changes, preserved manual edits and retained records absent from the CSV.
- Initial source-only status counts: Sent 65, Replied 5, Draft 8, Not sent 107; LinkedIn Connected 15, Invite sent 67, Queued 52. Live summaries also include retained contacts not present in the source.

Validation: 84 application tests, TypeScript/lint, production build and 37 security-rule tests. Synthetic browser QA checked TR/EN country summaries, filters, the due list, LinkedIn link/status, faded Left state, red warning and separate notes/reply timelines. The expanded rules keep all four collections admin-only, validate optional field values/lengths, restrict metadata and preserve legacy document compatibility. Official website/contact enrichment was not performed for this import.
