// Official websites inspected on 2026-10-21. Blank values mean unverified.
// Products supplied by the directory owner are retained even if a site is unavailable.
export const sectors = [
 ['havlu','Havlu','Towels & Home Textile'],['hazir-giyim','Hazır Giyim','Apparel'],['meyve-suyu','Meyve Suyu','Beverages & Juices'],
 ['flour-grains-pasta','Un, Tahıl ve Makarna','Flour, Grains & Pasta'],['snacks-nuts','Atıştırmalık ve Kuruyemiş','Snacks & Nuts'],
 ['confectionery','Şekerleme, Bisküvi ve Çikolata','Confectionery, Biscuits & Chocolate'],['processed-fruit','İşlenmiş Meyve ve Reçel','Processed Fruit & Jams'],
 ['sauces-ingredients','Soslar ve Gıda Bileşenleri','Sauces, Condiments & Food Ingredients'],['furniture','Mobilya ve Yatak','Furniture & Mattresses'],
 ['packaging','Ambalaj','Packaging'],['personal-care','Kişisel Bakım','Personal Care'],['batteries','Akü ve Enerji Depolama','Batteries & Energy Storage'],['veterinary','Veteriner Ürünleri','Veterinary Products'],
];
const rows = [
 ['flour-grains-pasta','Globalvore','https://globalvore.com/en','High-protein flours and bakery mixes','Ankara, Turkey','Offers high-protein bakery mixes under the BÄKKER brand.',''],
 ['flour-grains-pasta','Le Gurme','https://legurme.com/','Value-added grains, granola, ready-to-eat snacks','Ankara, Turkey','Offers grains, ready-to-eat foods, granola and snack products.',''],
 ['flour-grains-pasta','Mutlu Makarna','https://www.mutlumakarna.com.tr/tr/','Pasta','Gaziantep, Turkey','Produces pasta in classic, vegetable and whole-wheat ranges.',''],
 ['snacks-nuts','Rawsome','https://www.rawsome.com.tr/en','Fruit bars','Istanbul, Turkey','Offers fruit and nut bars, protein bars and granola.',''],
 ['snacks-nuts','Milhans','https://www.milhans.com.tr/','Nuts','Gebze, Kocaeli, Turkey','Offers nuts under its consumer brands, with private-label and food-service options.',''],
 ['confectionery','Bifa','https://www.bifa.com.tr/en','Cakes, biscuits, wafers, crackers, everyday chocolates','Karaman, Turkey','Offers cakes, biscuits, wafers, crackers and chocolate products.',''],
 ['confectionery','Tayaş','https://www.tayas.com.tr/','Hard candy, jelly, biscuits, bars, licorice, confectionery, chocolates','Gebze, Kocaeli, Turkey','Produces confectionery, cocoa products, biscuit products, bars and licorice.','BRCGS V9, IFS Food V8, ISO 9001:2015, Halal (TSE, HCS, Halal Center), ISO 27001:2013'],
 ['confectionery','Bind Chocolate','https://www.bindchocolate.com/','Premium chocolates','Istanbul, Turkey','Produces boutique chocolates, gift selections and personalised chocolates.',''],
 ['processed-fruit','Fruiterra','https://fruiterra.com.tr/','Canned and frozen fruits','Salihli, Manisa, Turkey','Produces and exports canned fruit, including citrus fruit, cherries and grapes.',''],
 ['processed-fruit','Pols Gurme','https://www.polsgurme.com/','Freeze-dried fruit','Istanbul, Turkey','Offers freeze-dried fruit and fruit powders, alongside jams and tahini products.',''],
 ['processed-fruit','Seğmen','https://www.segmen.com.tr/','Jam','Ankara, Turkey','Offers jams, marmalades, tahini and molasses.',''],
 ['meyve-suyu','Maxfly Energy','https://maxflyenergy.com/','Energy drinks','Istanbul, Turkey','Offers energy drinks in original and flavoured varieties.',''],
 ['meyve-suyu','Elite Naturel','https://elitenaturel.com/','Organic juices','Ankara, Turkey','Grows and processes organic fruit and vegetables for packaged food and beverage products.',''],
 ['meyve-suyu','Ben Organic','https://www.benorganic.com/en/','Organic juices','Ankara, Turkey','Offers organic fruit and vegetable juices under the BenOrganic brand.',''],
 ['sauces-ingredients','Tat Gıda','https://www.tatgida.com.tr/','Tomato paste, tomatoes, sauces, convenience foods, pickles','','',''],
 ['sauces-ingredients','Kent Boringer','https://www.kentboringer.com/','Drink mixes, liquid products, spreads, bouillons, baking ingredients','','Offers powdered drinks, topping sauces and baking ingredients.',''],
 ['havlu','Sanko Towel','https://www.sankotowel.com/','Towels','Gaziantep, Turkey','Offers towel and home textile products as part of Sanko Textile.','ISO 9001:2015, ISO 14001:2015, ISO 45001:2018, OEKO-TEX Standard 100, GOTS, OEKO-TEX Made in Green, GRS, OCS 100, ISO 50001:2018'],
 ['havlu','Özdilek Ev Tekstili','https://www.ozdilekevtekstili.com.tr/en/','Home textiles','Bursa, Turkey','Offers home textile products under the Özdilek brand.',''],
 ['havlu','Alasev Tekstil','https://alasevtekstil.com/en/','Home organizers','Istanbul, Turkey','Produces home textile products including storage bags, boxes, baskets and organizers.',''],
 ['furniture','BRN Yatak','https://brnyatak.com.tr/','Mattresses, compressed sofas','Kayseri, Turkey','Offers mattresses and sleep products.',''],
 ['packaging','Lima Pack','https://limapack.com.tr/','Plastic packaging, shrink wraps','Kahramankazan, Ankara, Turkey','Produces industrial, food-contact and textile packaging, including shrink and stretch films.',''],
 ['personal-care','Evyap','https://www.evyap.com.tr/en','Personal care products','Istanbul, Turkey','Operates in personal hygiene, personal care and personal wash products.',''],
 ['batteries','Yiğit Akü','https://yigitaku.com/en','Automotive, industrial and lithium batteries','Ankara, Turkey','Produces starter, industrial and lithium batteries.','IATF 16949, ISO 10002, ISO 50001, ISO 9001, ISO 27001, ISO 45001:2018, ISO 14001:2015'],
 ['veterinary','WinPet Medikal','https://winpet.eu/','Post-operative medical vests for veterinary use','Bor, Niğde, Turkey','Offers MedVest recovery garments for pets following surgery.',''],
];
export const suppliers = rows.map(([sectorId,name,website,products,location,description,certificates])=>({sectorId,name,website,products,location,description,certificates}));
export const evidence: Record<string,string[]> = {
 Seğmen:['https://www.segmen.com.tr/kurumsal/hakkimizda'], 'Alasev Tekstil':['https://alasevtekstil.com/en/products/'], Rawsome:['https://www.rawsome.com.tr/en/pages/on-bilgilendirme-formu'], Evyap:['https://www.evyap.com.tr/merkezlerimiz'], 'Pols Gurme':['https://www.polsgurme.com/pages/contact'], 'BRN Yatak':['https://brnyatak.com.tr/pages/i%CC%87letisim'], Globalvore:['https://globalvore.com/en'], 'Le Gurme':['https://legurme.com/contact/','https://legurme.com/','https://legurme.com/certificates/'],
 'Mutlu Makarna':['https://www.mutlumakarna.com.tr/tr/iletisim'], Milhans:['https://www.milhans.com.tr/iletisim/'],
 Bifa:['https://www.bifa.com.tr/en/contact'], Tayaş:['https://www.tayas.com.tr/sertifikalarimiz/','https://www.tayas.com.tr/iletisim/'],
 'Bind Chocolate':['https://www.bindchocolate.com/en/Iletisim'], 'Ben Organic':['https://www.benorganic.com/en/contact-us/'],
 'Sanko Towel':['https://www.sankotowel.com/certificates.php'], 'Özdilek Ev Tekstili':['https://www.ozdilekevtekstili.com.tr/en/contact'],
 'Lima Pack':['https://limapack.com.tr/iletisim/'], 'Yiğit Akü':['https://yigitaku.com/en/certificates','https://yigitaku.com/en/contact-us'],
};
