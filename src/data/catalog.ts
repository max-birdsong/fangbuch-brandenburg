// Option lists used in the app. Codes are what gets stored in the database; labels are per language.
// IFB TODO: review species list, methods and license types with colleagues before the pilot.

export type Lang = 'de' | 'en';
type Labelled = { code: string; de: string; en: string };

export const SPECIES: Labelled[] = [
  { code: 'zander', de: 'Zander', en: 'Zander' },
  { code: 'pike', de: 'Hecht', en: 'Pike' },
  { code: 'perch', de: 'Barsch', en: 'Perch' },
  { code: 'asp', de: 'Rapfen', en: 'Asp' },
  { code: 'wels', de: 'Wels', en: 'Wels catfish' },
  { code: 'eel', de: 'Aal', en: 'Eel' },
  { code: 'bream', de: 'Brassen (Blei)', en: 'Bream' },
  { code: 'roach', de: 'Plötze', en: 'Roach' },
  { code: 'carp', de: 'Karpfen', en: 'Carp' },
  { code: 'tench', de: 'Schleie', en: 'Tench' },
  { code: 'ide', de: 'Aland', en: 'Ide' },
  { code: 'burbot', de: 'Quappe', en: 'Burbot' },
  { code: 'chub', de: 'Döbel', en: 'Chub' },
  { code: 'rudd', de: 'Rotfeder', en: 'Rudd' },
  { code: 'silver_bream', de: 'Güster', en: 'Silver bream' },
  { code: 'crucian', de: 'Karausche', en: 'Crucian carp' },
  { code: 'gibel', de: 'Giebel', en: 'Prussian carp' },
  { code: 'bleak', de: 'Ukelei', en: 'Bleak' },
  { code: 'dace', de: 'Hasel', en: 'Dace' },
  { code: 'vimba', de: 'Zährte', en: 'Vimba' },
  { code: 'barbel', de: 'Barbe', en: 'Barbel' },
  { code: 'nase', de: 'Nase', en: 'Nase' },
  { code: 'ruffe', de: 'Kaulbarsch', en: 'Ruffe' },
  { code: 'brown_trout', de: 'Bachforelle', en: 'Brown trout' },
  { code: 'sea_trout', de: 'Meerforelle', en: 'Sea trout' },
  { code: 'rainbow_trout', de: 'Regenbogenforelle', en: 'Rainbow trout' },
  { code: 'grass_carp', de: 'Graskarpfen', en: 'Grass carp' },
  { code: 'sturgeon', de: 'Stör', en: 'Sturgeon' },
  { code: 'round_goby', de: 'Schwarzmundgrundel', en: 'Round goby' },
  { code: 'other', de: 'Andere Art', en: 'Other species' }
];
export const QUICK_SPECIES = ['zander', 'pike', 'perch', 'asp', 'wels', 'eel', 'bream', 'roach', 'carp', 'tench', 'ide'];

export const TARGETS: Labelled[] = [
  { code: 'zander', de: 'Zander', en: 'Zander' },
  { code: 'pike', de: 'Hecht', en: 'Pike' },
  { code: 'perch', de: 'Barsch', en: 'Perch' },
  { code: 'asp', de: 'Rapfen', en: 'Asp' },
  { code: 'wels', de: 'Wels', en: 'Wels catfish' },
  { code: 'eel', de: 'Aal', en: 'Eel' },
  { code: 'carp', de: 'Karpfen', en: 'Carp' },
  { code: 'coarse', de: 'Friedfisch', en: 'Coarse fish' },
  { code: 'trout', de: 'Forelle', en: 'Trout' },
  { code: 'any', de: 'Egal', en: 'Anything' }
];

export const METHODS: Labelled[] = [
  { code: 'spin', de: 'Spinnangeln', en: 'Lure fishing' },
  { code: 'bottom', de: 'Grundangeln', en: 'Ledgering' },
  { code: 'float', de: 'Posenangeln', en: 'Float fishing' },
  { code: 'feeder', de: 'Feederangeln', en: 'Feeder fishing' },
  { code: 'fly', de: 'Fliegenfischen', en: 'Fly fishing' },
  { code: 'vertical', de: 'Vertikalangeln', en: 'Vertical jigging' },
  { code: 'troll', de: 'Schleppangeln', en: 'Trolling' },
  { code: 'other', de: 'Andere', en: 'Other' }
];

export const PLATFORMS: Labelled[] = [
  { code: 'shore', de: 'Ufer', en: 'Shore' },
  { code: 'boat', de: 'Boot', en: 'Boat' },
  { code: 'wading', de: 'Watend', en: 'Wading' }
];

export const CLUB_STATUS: Labelled[] = [
  { code: 'active', de: 'Ja, aktiv', en: 'Yes, active' },
  { code: 'passive', de: 'Ja, passiv', en: 'Yes, passive' },
  { code: 'none', de: 'Nein', en: 'No' }
];

export const LICENSES: (Labelled & { sub_de?: string; sub_en?: string })[] = [
  { code: 'lavb_member', de: 'Vereinsmitgliedschaft (LAVB-Gewässer)', en: 'Club membership (LAVB waters)', sub_de: 'Beitragsmarke des Landesanglerverbands Brandenburg', sub_en: 'Membership stamp of the Brandenburg anglers association' },
  { code: 'oder_member', de: 'Große Oderkarte (Mitglied)', en: 'Große Oderkarte (member)' },
  { code: 'oder_nonmember', de: 'Große Oderkarte (Nichtmitglied)', en: 'Große Oderkarte (non-member)' },
  { code: 'fishery_company', de: 'Angelkarte eines Fischereibetriebs', en: 'License from a fishery company' },
  { code: 'day_week', de: 'Tages- oder Wochenkarte', en: 'Day or week ticket' },
  { code: 'other', de: 'Andere Angelkarte', en: 'Other license' }
];

export const COUNTRIES: Labelled[] = [
  { code: 'DE', de: 'Deutschland', en: 'Germany' },
  { code: 'PL', de: 'Polen', en: 'Poland' },
  { code: 'other', de: 'Anderes Land', en: 'Other country' }
];

export const label = (list: Labelled[], code: string | null | undefined, lang: Lang) =>
  list.find((x) => x.code === code)?.[lang] ?? code ?? '';
