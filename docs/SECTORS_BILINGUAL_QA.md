# Sectors bilingual content — implementation and QA

18 October 2026. Translation approval is pending. No production data was written and no deployment/push was performed.

## Source and review

Read-only production enumeration: **3 sectors, 11 companies**. Initial review included 59 nonempty sector/company text and contact-title fields. Browser inspection also identified Turkish qualifiers in `foundedYear` and `employees`; their 15 nonempty values are now included, bringing the review to **74 EN values**. Of those additional values, 13 contain numbers only and are copied exactly; two retain their numbers and translate `(tahmini)` to `(estimated)`.

- Review: [SECTORS_TRANSLATION_REVIEW.md](SECTORS_TRANSLATION_REVIEW.md)
- Machine-readable review with source checksum and document updateTime values: [SECTORS_TRANSLATION_REVIEW.json](SECTORS_TRANSLATION_REVIEW.json)
- Raw typed REST source remains in ignored `backups/directory-translations-2026-10-18T18-43-32-349Z/source.json`; its SHA-256 was verified after saving. This is a scoped read snapshot, not the fresh full backup required before future live writes.

## Data shape and access

TR stays in existing scalar fields. EN is an optional `translations.en` map. Sector labels use `translations.en.name`; company text uses the corresponding field names. Contact job titles use `translations.en.contactTitles[contact.id]`, so a future migration need not replace the contacts array and titles survive reordering.

Identity/contact fields stay single and are not migrated: company name, brand name embedded in names, person name, address, city/district/country/location, phone, email, website and catalogue URL. Sector IDs and contact IDs are unchanged. No separate brand-name field exists in the current schema. Names such as Evliyaoğlu Tekstil, Emel Özler, Denizli and Honaz retain their spelling. Only the known annotations `(örnek)` and `(Genel Merkez)` in shared values are rendered through UI translations as `(sample)` and `(Head Office)`; raw values and names are unchanged.

Existing rules already accept the new map with admin-only access. Live records have at most 24 root fields; adding one container remains below the 30-field company limit. **No rules change or deployment is needed.** A new emulator rules test verifies admin bilingual writes, unchanged original fields and denial of reads/writes for other roles and anonymous access.

## Browser verification

Chrome, local application at `http://localhost:3011`, **demo emulator only**, with a copy of the 14 live records plus the proposed translations. This tests the proposed result before approval; it does not claim translations are visible in production.

- Opened Apparel (3), Fruit Juice (3), Towels & Bathrobes (5), and inspected all company details.
- Verified professional English product lists, descriptions, capacities, specifications, packaging, certificates, export information, notes and contact job titles. Numeric/unit/year tokens are also checked against TR by a unit test.
- Verified EN search with `estimated`, returning Lenora. Its year and employee qualifiers now display `2012 (estimated)` and `150+ (estimated)`.
- Inspected company edit form: all translatable fields and contact job titles have TR/EN entries; identity and contact fields have one entry. Existing TR values deliberately remain visible inside TR inputs in EN mode, as required for bilingual editing.
- Sector creation and renaming use TR/EN inputs.
- Temporarily cleared PMG's EN notes and saved **only in the emulator**: the card displayed `Not translated` and its original TR notes. Restored the complete review set afterwards.
- Verified sample phone/person annotations and Head Office label in EN without changing the shared raw identity fields.

Remaining Turkish spelling is confined to intentionally preserved names/addresses/contact data: company legal names (including Tekstil, Gıda and Konfeksiyon), people (Emel Özler, Şenay Karakozak, Faruk Oğuz, Elif Demir), locations such as Denizli, Honaz, Merkezefendi, Sarayköy, Pamukkale, İstanbul, Şişli, Ankara, Niğde, Eskişehir, Bursa and Türkiye, street/address text, and Borsa İstanbul. The review intentionally retains country/place labels Almanya, Hollanda, İngiltere and ABD in narratives under the user's strict instruction to preserve place names. These are called out for editorial review, not treated as missing application translations. User/project names in the surrounding workspace are also unchanged.

## Validation

`npm run check` (typecheck, unit tests, production build) and `npm run test:rules` passed. New unit tests cover EN/TR selection, whitespace fallback, missing markers, stable contact IDs, preservation of identity/TR values, unique complete review rows and identical numeric/unit tokens. No new library was added. Existing Vite bundle-size advisory remains.

## Future approved migration

Requires separate approval of the review. Before any write: take a fresh full backup and verify its checksum. Match each live document's updateTime to the review's sourceVersions; skip and report changed/missing records. Add only absent approved EN field paths with an exact update mask and updateTime precondition; never update TR, identity, timestamps or unrelated fields. Compare all other fields afterwards and demonstrate zero changes on the second run. The current export script supports only read-only mode; the preview script rejects non-loopback/non-demo targets and cannot write production.

The user's untracked company scripts and `scripts/data/` were not edited. Their future compatibility approach is documented in the review.
