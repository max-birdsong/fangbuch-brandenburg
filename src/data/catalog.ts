// Option lists used in the app. Codes are what gets stored in the database; labels are per language.
// IFB TODO: review species list, methods and license types with colleagues before the pilot.
// Polish labels are drafts: have a Polish angler check them (species names, PZW permit types).

export type Lang = 'de' | 'en' | 'pl';
export const LANGS: Lang[] = ['de', 'en', 'pl'];
type Labelled = { code: string; de: string; en: string; pl: string };

export const SPECIES: Labelled[] = [
  { code: 'zander', de: 'Zander', en: 'Zander', pl: 'Sandacz' },
  { code: 'pike', de: 'Hecht', en: 'Pike', pl: 'Szczupak' },
  { code: 'perch', de: 'Barsch', en: 'Perch', pl: 'Okoń' },
  { code: 'asp', de: 'Rapfen', en: 'Asp', pl: 'Boleń' },
  { code: 'wels', de: 'Wels', en: 'Wels catfish', pl: 'Sum' },
  { code: 'eel', de: 'Aal', en: 'Eel', pl: 'Węgorz' },
  { code: 'bream', de: 'Brassen (Blei)', en: 'Bream', pl: 'Leszcz' },
  { code: 'roach', de: 'Plötze', en: 'Roach', pl: 'Płoć' },
  { code: 'carp', de: 'Karpfen', en: 'Carp', pl: 'Karp' },
  { code: 'tench', de: 'Schleie', en: 'Tench', pl: 'Lin' },
  { code: 'ide', de: 'Aland', en: 'Ide', pl: 'Jaź' },
  { code: 'burbot', de: 'Quappe', en: 'Burbot', pl: 'Miętus' },
  { code: 'chub', de: 'Döbel', en: 'Chub', pl: 'Kleń' },
  { code: 'rudd', de: 'Rotfeder', en: 'Rudd', pl: 'Wzdręga' },
  { code: 'silver_bream', de: 'Güster', en: 'Silver bream', pl: 'Krąp' },
  { code: 'crucian', de: 'Karausche', en: 'Crucian carp', pl: 'Karaś pospolity' },
  { code: 'gibel', de: 'Giebel', en: 'Prussian carp', pl: 'Karaś srebrzysty' },
  { code: 'bleak', de: 'Ukelei', en: 'Bleak', pl: 'Ukleja' },
  { code: 'dace', de: 'Hasel', en: 'Dace', pl: 'Jelec' },
  { code: 'vimba', de: 'Zährte', en: 'Vimba', pl: 'Certa' },
  { code: 'barbel', de: 'Barbe', en: 'Barbel', pl: 'Brzana' },
  { code: 'nase', de: 'Nase', en: 'Nase', pl: 'Świnka' },
  { code: 'ruffe', de: 'Kaulbarsch', en: 'Ruffe', pl: 'Jazgarz' },
  { code: 'brown_trout', de: 'Bachforelle', en: 'Brown trout', pl: 'Pstrąg potokowy' },
  { code: 'sea_trout', de: 'Meerforelle', en: 'Sea trout', pl: 'Troć wędrowna' },
  { code: 'rainbow_trout', de: 'Regenbogenforelle', en: 'Rainbow trout', pl: 'Pstrąg tęczowy' },
  { code: 'grass_carp', de: 'Graskarpfen', en: 'Grass carp', pl: 'Amur biały' },
  { code: 'sturgeon', de: 'Stör', en: 'Sturgeon', pl: 'Jesiotr' },
  { code: 'round_goby', de: 'Schwarzmundgrundel', en: 'Round goby', pl: 'Babka bycza' },
  { code: 'other', de: 'Andere Art', en: 'Other species', pl: 'Inny gatunek' }
];
export const QUICK_SPECIES = ['zander', 'pike', 'perch', 'asp', 'wels', 'eel', 'bream', 'roach', 'carp', 'tench', 'ide'];

export const TARGETS: Labelled[] = [
  { code: 'zander', de: 'Zander', en: 'Zander', pl: 'Sandacz' },
  { code: 'pike', de: 'Hecht', en: 'Pike', pl: 'Szczupak' },
  { code: 'perch', de: 'Barsch', en: 'Perch', pl: 'Okoń' },
  { code: 'asp', de: 'Rapfen', en: 'Asp', pl: 'Boleń' },
  { code: 'wels', de: 'Wels', en: 'Wels catfish', pl: 'Sum' },
  { code: 'eel', de: 'Aal', en: 'Eel', pl: 'Węgorz' },
  { code: 'carp', de: 'Karpfen', en: 'Carp', pl: 'Karp' },
  { code: 'coarse', de: 'Friedfisch', en: 'Coarse fish', pl: 'Ryby spokojnego żeru' },
  { code: 'trout', de: 'Forelle', en: 'Trout', pl: 'Pstrąg' },
  { code: 'any', de: 'Egal', en: 'Anything', pl: 'Obojętnie' }
];

export const METHODS: Labelled[] = [
  { code: 'spin', de: 'Spinnangeln', en: 'Lure fishing', pl: 'Spinning' },
  { code: 'bottom', de: 'Grundangeln', en: 'Ledgering', pl: 'Grunt' },
  { code: 'float', de: 'Posenangeln', en: 'Float fishing', pl: 'Spławik' },
  { code: 'feeder', de: 'Feederangeln', en: 'Feeder fishing', pl: 'Feeder' },
  { code: 'fly', de: 'Fliegenfischen', en: 'Fly fishing', pl: 'Mucha' },
  { code: 'vertical', de: 'Vertikalangeln', en: 'Vertical jigging', pl: 'Spinning pionowy (wertykalny)' },
  { code: 'troll', de: 'Schleppangeln', en: 'Trolling', pl: 'Trolling' },
  { code: 'other', de: 'Andere', en: 'Other', pl: 'Inna' }
];

export const PLATFORMS: Labelled[] = [
  { code: 'shore', de: 'Ufer', en: 'Shore', pl: 'Z brzegu' },
  { code: 'boat', de: 'Boot', en: 'Boat', pl: 'Z łodzi' },
  { code: 'wading', de: 'Watend', en: 'Wading', pl: 'W woderach (brodząc)' }
];

export const CLUB_STATUS: Labelled[] = [
  { code: 'active', de: 'Ja, aktiv', en: 'Yes, active', pl: 'Tak, aktywnie' },
  { code: 'passive', de: 'Ja, passiv', en: 'Yes, passive', pl: 'Tak, tylko formalnie' },
  { code: 'none', de: 'Nein', en: 'No', pl: 'Nie' }
];

// cc: where the licence applies, used to list the angler's own country first.
export type License = Labelled & { cc: 'DE' | 'PL' | null; sub?: { de: string; en: string; pl: string } };
export const LICENSES: License[] = [
  { code: 'lavb_member', cc: 'DE', de: 'Vereinsmitgliedschaft (LAVB-Gewässer)', en: 'Club membership (LAVB waters)', pl: 'Członkostwo w klubie (wody LAVB, Brandenburgia)', sub: { de: 'Beitragsmarke des Landesanglerverbands Brandenburg', en: 'Membership stamp of the Brandenburg anglers association', pl: 'Znaczek składki związku wędkarskiego Brandenburgii' } },
  { code: 'oder_member', cc: 'DE', de: 'Große Oderkarte (Mitglied)', en: 'Große Oderkarte (member)', pl: 'Große Oderkarte (członek)' },
  { code: 'oder_nonmember', cc: 'DE', de: 'Große Oderkarte (Nichtmitglied)', en: 'Große Oderkarte (non-member)', pl: 'Große Oderkarte (niezrzeszony)' },
  { code: 'pzw_member', cc: 'PL', de: 'PZW-Mitgliedschaft mit Gewässerbeitrag', en: 'PZW membership with water fee', pl: 'Członkostwo PZW ze składką na ochronę i zagospodarowanie wód', sub: { de: 'Polnischer Anglerverband, Bezirk (Okręg)', en: 'Polish Angling Association, district (okręg)', pl: 'Polski Związek Wędkarski, okręg' } },
  { code: 'pzw_short', cc: 'PL', de: 'PZW-Kurzzeiterlaubnis (Tag/Woche)', en: 'PZW short-term permit (day/week)', pl: 'Zezwolenie krótkoterminowe PZW (dzień/tydzień)' },
  { code: 'fishery_company', cc: null, de: 'Angelkarte eines Fischereibetriebs', en: 'License from a fishery company', pl: 'Zezwolenie gospodarstwa rybackiego lub łowiska' },
  { code: 'day_week', cc: 'DE', de: 'Tages- oder Wochenkarte', en: 'Day or week ticket', pl: 'Karta dzienna lub tygodniowa (Niemcy)' },
  { code: 'other', cc: null, de: 'Andere Angelkarte', en: 'Other license', pl: 'Inne zezwolenie' }
];

export const COUNTRIES: Labelled[] = [
  { code: 'DE', de: 'Deutschland', en: 'Germany', pl: 'Niemcy' },
  { code: 'PL', de: 'Polen', en: 'Poland', pl: 'Polska' },
  { code: 'other', de: 'Anderes Land', en: 'Other country', pl: 'Inny kraj' }
];

export const label = (list: Labelled[], code: string | null | undefined, lang: Lang) =>
  list.find((x) => x.code === code)?.[lang] ?? code ?? '';

// What anglers can choose to be emailed about (stored as codes on the profile, all optional).
export const CONTACT_OPTINS: Labelled[] = [
  { code: 'results', de: 'Ergebnisse der Studie', en: 'Results of the study', pl: 'Wyniki badania' },
  { code: 'studies', de: 'Einladungen zu weiteren Studien des IfB', en: 'Invitations to further IfB studies', pl: 'Zaproszenia do kolejnych badań IfB' }
];

/**
 * Largest plausible total length per species (cm), roughly the largest fish recorded in central
 * Europe. Above this the app asks the angler to confirm; above 1.5x it refuses (likely a typo,
 * e.g. mm instead of cm). IFB TODO: have a fish biologist check these values.
 */
export const SPECIES_MAX_CM: Record<string, number> = {
  zander: 110, pike: 140, perch: 60, asp: 110, wels: 280, eel: 150, bream: 85, roach: 50, carp: 120,
  tench: 70, ide: 85, burbot: 100, chub: 80, rudd: 50, silver_bream: 45, crucian: 55, gibel: 50,
  bleak: 25, dace: 40, vimba: 50, barbel: 100, nase: 60, ruffe: 30, brown_trout: 100, sea_trout: 120,
  rainbow_trout: 100, grass_carp: 140, sturgeon: 300, round_goby: 30
};
