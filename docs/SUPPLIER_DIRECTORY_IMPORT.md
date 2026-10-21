# Supplier directory import — 21 October 2026

Applied to the existing configured Firestore database after a dry run. 10 sectors and 23 companies added; 3 existing sectors and 11 existing companies updated. Total: 13 sectors, 34 companies (including the existing fictional demo). Atomic commit: 47 documents. Replanning after application produced zero changes; populated original values were verified unchanged.

Existing TR text, company names and contact details were preserved. Existing companies received English translations, including locations and addresses. The existing Elite Naturel record was enriched rather than duplicated. All real companies have the Long-standing contact tag; the fictional demo retains its demo identity. New company TR fields use the same English content, as requested. New contact person, email and phone fields are empty. No records were deleted.

## Added sectors

- Un, Tahıl ve Makarna
- Atıştırmalık ve Kuruyemiş
- Şekerleme, Bisküvi ve Çikolata
- İşlenmiş Meyve ve Reçel
- Soslar ve Gıda Bileşenleri
- Mobilya ve Yatak
- Ambalaj
- Kişisel Bakım
- Akü ve Enerji Depolama
- Veteriner Ürünleri

## Companies

| Company | Result | Website and additional evidence |
|---|---|---|
| Globalvore | Added | [Source](https://globalvore.com/en) |
| Le Gurme | Added | [Source](https://legurme.com/); [Source](https://legurme.com/contact/); [Source](https://legurme.com/certificates/) |
| Mutlu Makarna | Added | [Source](https://www.mutlumakarna.com.tr/tr/); [Source](https://www.mutlumakarna.com.tr/tr/iletisim) |
| Rawsome | Added | [Source](https://www.rawsome.com.tr/en); [Source](https://www.rawsome.com.tr/en/pages/on-bilgilendirme-formu) |
| Milhans | Added | [Source](https://www.milhans.com.tr/); [Source](https://www.milhans.com.tr/iletisim/) |
| Bifa | Added | [Source](https://www.bifa.com.tr/en); [Source](https://www.bifa.com.tr/en/contact) |
| Tayaş | Added | [Source](https://www.tayas.com.tr/); [Source](https://www.tayas.com.tr/sertifikalarimiz/); [Source](https://www.tayas.com.tr/iletisim/) |
| Bind Chocolate | Added | [Source](https://www.bindchocolate.com/); [Source](https://www.bindchocolate.com/en/Iletisim) |
| Fruiterra | Added | [Source](https://fruiterra.com.tr/) |
| Pols Gurme | Added | [Source](https://www.polsgurme.com/); [Source](https://www.polsgurme.com/pages/contact) |
| Seğmen | Added | [Source](https://www.segmen.com.tr/); [Source](https://www.segmen.com.tr/kurumsal/hakkimizda) |
| Maxfly Energy | Added | [Source](https://maxflyenergy.com/) |
| Elite Naturel | Existing record enriched | [Source](https://elitenaturel.com/) |
| Ben Organic | Added | [Source](https://www.benorganic.com/en/); [Source](https://www.benorganic.com/en/contact-us/) |
| Tat Gıda | Added | [Source](https://www.tatgida.com.tr/) |
| Kent Boringer | Added | [Source](https://www.kentboringer.com/) |
| Sanko Towel | Added | [Source](https://www.sankotowel.com/); [Source](https://www.sankotowel.com/certificates.php) |
| Özdilek Ev Tekstili | Added | [Source](https://www.ozdilekevtekstili.com.tr/en/); [Source](https://www.ozdilekevtekstili.com.tr/en/contact) |
| Alasev Tekstil | Added | [Source](https://alasevtekstil.com/en/); [Source](https://alasevtekstil.com/en/products/) |
| BRN Yatak | Added | [Source](https://brnyatak.com.tr/); [Source](https://brnyatak.com.tr/pages/i%CC%87letisim) |
| Lima Pack | Added | [Source](https://limapack.com.tr/); [Source](https://limapack.com.tr/iletisim/) |
| Evyap | Added | [Source](https://www.evyap.com.tr/en); [Source](https://www.evyap.com.tr/merkezlerimiz) |
| Yiğit Akü | Added | [Source](https://yigitaku.com/en); [Source](https://yigitaku.com/en/certificates); [Source](https://yigitaku.com/en/contact-us) |
| WinPet Medikal | Added | [Source](https://winpet.eu/) |

## Existing companies translated

- Gökhan Tekstil (Soft Cotton)
- Kiğılı Giyim Tic. A.Ş.
- Sarar
- Makroteks Tekstil
- MTC Linen
- PMG Gıda
- Anadolu Moda Konfeksiyon Ltd. Şti.
- Lenora Tekstil A.Ş.
- Elite Naturel Organik Gıda San. ve Tic. A.Ş.
- Evliyaoğlu Tekstil (MaxxSoftHome)
- Göknur Gıda Maddeleri Enerji İmalat İthalat İhracat Tic. ve San. A.Ş.

## Unverified and left empty

- Globalvore: certificates
- Le Gurme: certificates
- Mutlu Makarna: certificates
- Rawsome: certificates
- Milhans: certificates
- Bifa: certificates
- Bind Chocolate: certificates
- Fruiterra: certificates
- Pols Gurme: certificates
- Seğmen: certificates
- Maxfly Energy: certificates
- Ben Organic: certificates
- Tat Gıda: location, description, certificates
- Kent Boringer: location, certificates
- Özdilek Ev Tekstili: certificates
- Alasev Tekstil: certificates
- BRN Yatak: certificates
- Lima Pack: certificates
- Evyap: certificates
- WinPet Medikal: certificates

All new contact details remain empty by instruction. Other optional fields without verified information (e.g. capacity, workforce, foundation year and export markets) were also left empty. Tat Gıda could not be fetched; its product list is owner-supplied. Other product lists combine owner-supplied groups with inspected official websites. Certification pages substantiate website listings only, not independently checked certificate validity. Existing certification claims were translated faithfully, including explicit estimated/unverified qualifiers; they were not newly verified. Fruiterra mentions BRC/IFS/HACCP management systems without accessible certificate evidence, so its certificates field was left empty. Ben Organic and Le Gurme certification pages did not expose readable certificates.

## Reuse

```sh
node --import tsx scripts/supplier-directory/run.ts
node --import tsx scripts/supplier-directory/run.ts --apply
```

The default mode writes only local private backups and a plan; Firestore stays read-only. Apply uses one atomic commit, document creation preconditions, version preconditions and masks for filled fields. Existing nonempty EN and TR values are never replaced. Duplicate detection uses normalized company names and website hostnames; ambiguous matches abort. Each run stores its snapshot and full plan in ignored backups/. Firebase CLI authentication must be current.
