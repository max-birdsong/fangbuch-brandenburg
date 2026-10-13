// Writes public/waters.json with a hand-made STARTER list of well-known Brandenburg waters.
// Points are approximate (roughly within 1-2 km), good enough for the proof of concept.
// For the real list with shorelines and river lines, run: npm run import:waters
import { writeFile } from 'node:fs/promises';

const R = {
  oder: 'Oder & Neiße',
  havel: 'Havel & Potsdam',
  spree: 'Spree, Dahme & Spreewald',
  ostbb: 'Märkisch-Oderland & Oder-Spree',
  uckermark: 'Uckermark & Barnim',
  ruppin: 'Ruppin, Oberhavel & Prignitz',
  flaeming: 'Teltow-Fläming & Potsdam-Mittelmark',
  lausitz: 'Lausitz',
  elbe: 'Elbe & Elster'
};

// [id, name, type, region, lat, lon]
const rows = [
  // Oder & Neiße (river split into named stretches)
  ['oder-ratzdorf', 'Oder bei Ratzdorf (Neißemündung)', 'river', R.oder, 52.067, 14.755],
  ['oder-eisenhuettenstadt', 'Oder bei Eisenhüttenstadt', 'river', R.oder, 52.152, 14.683],
  ['oder-frankfurt', 'Oder bei Frankfurt (Oder)', 'river', R.oder, 52.345, 14.556],
  ['oder-lebus', 'Oder bei Lebus', 'river', R.oder, 52.428, 14.538],
  ['oder-kuestrin', 'Oder bei Küstrin-Kietz', 'river', R.oder, 52.573, 14.633],
  ['oder-zollbruecke', 'Oder bei Zollbrücke (Oderbruch)', 'river', R.oder, 52.737, 14.245],
  ['oder-hohensaaten', 'Oder bei Hohensaaten', 'river', R.oder, 52.876, 14.150],
  ['oder-schwedt', 'Oder bei Schwedt', 'river', R.oder, 53.058, 14.335],
  ['oder-gartz', 'Oder bei Gartz', 'river', R.oder, 53.208, 14.405],
  ['westoder', 'Westoder (Nationalpark Unteres Odertal)', 'river', R.oder, 53.150, 14.360],
  ['hofriwa', 'Hohensaaten-Friedrichsthaler Wasserstraße', 'canal', R.oder, 53.000, 14.200],
  ['alte-oder-freienwalde', 'Alte Oder bei Bad Freienwalde', 'river', R.oder, 52.790, 14.030],
  ['oder-spree-kanal', 'Oder-Spree-Kanal', 'canal', R.oder, 52.150, 14.620],
  ['neisse-guben', 'Neiße bei Guben', 'river', R.oder, 51.950, 14.720],
  ['neisse-forst', 'Neiße bei Forst', 'river', R.oder, 51.740, 14.650],

  // Havel & Potsdam
  ['havel-potsdam', 'Havel bei Potsdam', 'river', R.havel, 52.400, 13.060],
  ['sacrower-see', 'Sacrower See', 'lake', R.havel, 52.440, 13.100],
  ['templiner-see-potsdam', 'Templiner See (Potsdam)', 'lake', R.havel, 52.360, 13.020],
  ['schwielowsee', 'Schwielowsee', 'lake', R.havel, 52.335, 12.950],
  ['fahrlaender-see', 'Fahrländer See', 'lake', R.havel, 52.470, 13.010],
  ['grosser-zernsee', 'Großer Zernsee', 'lake', R.havel, 52.400, 12.930],
  ['havel-brandenburg', 'Havel bei Brandenburg an der Havel', 'river', R.havel, 52.410, 12.550],
  ['beetzsee', 'Beetzsee', 'lake', R.havel, 52.460, 12.550],
  ['plauer-see-bb', 'Plauer See (Brandenburg an der Havel)', 'lake', R.havel, 52.420, 12.450],
  ['breitlingsee', 'Breitlingsee', 'lake', R.havel, 52.400, 12.480],
  ['wusterwitzer-see', 'Wusterwitzer See', 'lake', R.havel, 52.380, 12.380],
  ['havel-rathenow', 'Havel bei Rathenow', 'river', R.havel, 52.600, 12.330],
  ['guelper-see', 'Gülper See', 'lake', R.havel, 52.740, 12.240],
  ['havel-havelberg', 'Havel bei Havelberg', 'river', R.havel, 52.830, 12.070],

  // Ruppin, Oberhavel & Prignitz
  ['havel-oranienburg', 'Havel bei Oranienburg', 'river', R.ruppin, 52.750, 13.240],
  ['havel-zehdenick', 'Havel bei Zehdenick', 'river', R.ruppin, 52.980, 13.330],
  ['lehnitzsee', 'Lehnitzsee', 'lake', R.ruppin, 52.770, 13.270],
  ['ruppiner-see', 'Ruppiner See', 'lake', R.ruppin, 52.880, 12.820],
  ['gudelacksee', 'Gudelacksee (Lindow)', 'lake', R.ruppin, 52.970, 12.970],
  ['grienericksee', 'Grienericksee (Rheinsberg)', 'lake', R.ruppin, 53.100, 12.890],
  ['grosser-stechlinsee', 'Großer Stechlinsee', 'lake', R.ruppin, 53.150, 13.030],
  ['rhin-fehrbellin', 'Rhin bei Fehrbellin', 'river', R.ruppin, 52.810, 12.760],
  ['dosse-wusterhausen', 'Dosse bei Wusterhausen', 'river', R.ruppin, 52.890, 12.460],
  ['stepenitz-perleberg', 'Stepenitz bei Perleberg', 'river', R.ruppin, 53.070, 11.860],

  // Uckermark & Barnim
  ['werbellinsee', 'Werbellinsee', 'lake', R.uckermark, 52.940, 13.730],
  ['grimnitzsee', 'Grimnitzsee', 'lake', R.uckermark, 52.970, 13.780],
  ['parsteiner-see', 'Parsteiner See', 'lake', R.uckermark, 52.930, 13.990],
  ['wolletzsee', 'Wolletzsee', 'lake', R.uckermark, 53.030, 13.970],
  ['oberuckersee', 'Oberuckersee', 'lake', R.uckermark, 53.200, 13.860],
  ['unteruckersee', 'Unteruckersee', 'lake', R.uckermark, 53.300, 13.860],
  ['luebbesee', 'Lübbesee (Templin)', 'lake', R.uckermark, 53.060, 13.530],
  ['wandlitzer-see', 'Wandlitzer See', 'lake', R.uckermark, 52.740, 13.450],
  ['liepnitzsee', 'Liepnitzsee', 'lake', R.uckermark, 52.730, 13.500],
  ['finowkanal', 'Finowkanal bei Eberswalde', 'canal', R.uckermark, 52.830, 13.820],
  ['oder-havel-kanal', 'Oder-Havel-Kanal bei Niederfinow', 'canal', R.uckermark, 52.850, 13.940],

  // Märkisch-Oderland & Oder-Spree
  ['straussee', 'Straussee', 'lake', R.ostbb, 52.580, 13.880],
  ['schermuetzelsee', 'Schermützelsee (Buckow)', 'lake', R.ostbb, 52.580, 14.070],
  ['scharmuetzelsee', 'Scharmützelsee', 'lake', R.ostbb, 52.230, 14.050],
  ['storkower-see', 'Storkower See', 'lake', R.ostbb, 52.240, 13.970],
  ['wolziger-see', 'Wolziger See', 'lake', R.ostbb, 52.250, 13.830],
  ['grosser-muellroser-see', 'Großer Müllroser See', 'lake', R.ostbb, 52.250, 14.420],
  ['helenesee', 'Helenesee', 'lake', R.ostbb, 52.280, 14.480],
  ['spree-fuerstenwalde', 'Spree bei Fürstenwalde', 'river', R.ostbb, 52.360, 14.060],
  ['spree-beeskow', 'Spree bei Beeskow', 'river', R.ostbb, 52.170, 14.250],
  ['schwielochsee', 'Schwielochsee', 'lake', R.ostbb, 52.050, 14.200],

  // Spree, Dahme & Spreewald
  ['dahme-kw', 'Dahme bei Königs Wusterhausen', 'river', R.spree, 52.300, 13.630],
  ['zeuthener-see', 'Zeuthener See', 'lake', R.spree, 52.340, 13.630],
  ['kruepelsee', 'Krüpelsee', 'lake', R.spree, 52.300, 13.680],
  ['spree-luebben', 'Spree bei Lübben (Spreewald)', 'river', R.spree, 51.940, 13.890],
  ['spree-cottbus', 'Spree bei Cottbus', 'river', R.spree, 51.760, 14.340],

  // Teltow-Fläming & Potsdam-Mittelmark
  ['rangsdorfer-see', 'Rangsdorfer See', 'lake', R.flaeming, 52.280, 13.420],
  ['mellensee', 'Mellensee', 'lake', R.flaeming, 52.150, 13.400],
  ['grosser-wuensdorfer-see', 'Großer Wünsdorfer See', 'lake', R.flaeming, 52.170, 13.460],
  ['seddiner-see', 'Großer Seddiner See', 'lake', R.flaeming, 52.270, 13.020],
  ['plessower-see', 'Plessower See', 'lake', R.flaeming, 52.370, 12.880],
  ['rietzer-see', 'Rietzer See', 'lake', R.flaeming, 52.370, 12.660],

  // Lausitz
  ['senftenberger-see', 'Senftenberger See', 'lake', R.lausitz, 51.490, 14.030],
  ['graebendorfer-see', 'Gräbendorfer See', 'lake', R.lausitz, 51.700, 14.100],
  ['grossraeschener-see', 'Großräschener See', 'lake', R.lausitz, 51.570, 14.020],

  // Elbe & Elster
  ['elbe-wittenberge', 'Elbe bei Wittenberge', 'river', R.elbe, 52.990, 11.750],
  ['elbe-muehlberg', 'Elbe bei Mühlberg', 'river', R.elbe, 51.430, 13.220],
  ['schwarze-elster', 'Schwarze Elster bei Bad Liebenwerda', 'river', R.elbe, 51.520, 13.400]
];

const waters = rows
  .map(([id, name, type, region, lat, lon]) => ({ id, name, type, region, lat, lon }))
  .sort((a, b) => a.name.localeCompare(b.name, 'de'));

const out = {
  version: 1,
  source: 'starter list (approximate points, hand-made). Replace via `npm run import:waters`.',
  generated: new Date().toISOString().slice(0, 10),
  regions: Object.values(R),
  waters
};
await writeFile(new URL('../public/waters.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(`Wrote ${waters.length} starter waters to public/waters.json`);
