// Display names of waters per language. The water list stores German names for Brandenburg waters
// ("Oder bei Schwedt/Oder"); Polish users see the border rivers under their Polish names, with a dash
// instead of "bei": "Odra – Schwedt/Oder". Display and search only; stored names stay unchanged.

export function localWaterName(name: string, lang: string) {
  if (lang !== 'pl') return name;
  return name
    .replace(/^Alte Oder\b/, 'Stara Odra')
    .replace(/^Oder\b/, 'Odra')
    .replace(/^Neiße\b/, 'Nysa Łużycka')
    .replace(/^Elbe\b/, 'Łaba')
    .replace(/ bei /, ' – ');
}

/** Extra search words so Polish names find the border rivers ("odra" finds "Oder bei ..."). */
export function searchAliases(name: string) {
  const out: string[] = [];
  if (/^(Alte )?Oder\b/.test(name)) out.push('odra');
  if (/^Neiße\b/.test(name)) out.push('nysa luzycka');
  if (/^Elbe\b/.test(name)) out.push('laba');
  return out.join(' ');
}
