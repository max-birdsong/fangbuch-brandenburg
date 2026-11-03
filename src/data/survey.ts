// =====================================================================================
// Baseline angler survey: EDIT QUESTIONS HERE.
//
// Shown as an optional card on the home screen after the angler's first fishing day.
// Every question is optional; answers are saved as you go and stored per item id.
//
// Editing rules
// - Item `id`s are the column names in the data. Never reuse an id for a different question.
//   If you change a question's meaning, give it a new id and bump SURVEY.version.
// - Text changes (typos, wording polish) are fine without a new id.
// - Scales are defined once in SCALES and referenced by key.
//
// IMPORTANT: item wordings below are reconstructed from the cited sources and the German
// versions are draft translations. Check against the original publications (and existing
// German versions used in IGB/IfB angler surveys) before fielding. The Polish versions are drafts
// too: have them checked by a native speaker, ideally against published Polish versions of the scales.
// =====================================================================================

export type Txt = { de: string; en: string; pl: string };

export type Scale = { points: Txt[] }; // 1..n, stored as numbers 1..n

export const SCALES = {
  agree5: {
    points: [
      { de: 'stimme überhaupt nicht zu', en: 'strongly disagree', pl: 'zdecydowanie się nie zgadzam' },
      { de: 'stimme eher nicht zu', en: 'disagree', pl: 'raczej się nie zgadzam' },
      { de: 'teils/teils', en: 'neutral', pl: 'ani tak, ani nie' },
      { de: 'stimme eher zu', en: 'agree', pl: 'raczej się zgadzam' },
      { de: 'stimme voll zu', en: 'strongly agree', pl: 'zdecydowanie się zgadzam' }
    ]
  },
  importance5: {
    points: [
      { de: 'überhaupt nicht wichtig', en: 'not at all important', pl: 'zupełnie nieważne' },
      { de: 'wenig wichtig', en: 'slightly important', pl: 'mało ważne' },
      { de: 'mittelmäßig wichtig', en: 'moderately important', pl: 'umiarkowanie ważne' },
      { de: 'sehr wichtig', en: 'very important', pl: 'bardzo ważne' },
      { de: 'extrem wichtig', en: 'extremely important', pl: 'niezwykle ważne' }
    ]
  }
} satisfies Record<string, Scale>;

export type ScaleKey = keyof typeof SCALES;

export type Item =
  | { id: string; type: 'likert'; scale: ScaleKey; text: Txt; reverse?: boolean }
  | { id: string; type: 'single'; text: Txt; options: { code: string; label: Txt }[] }
  | { id: string; type: 'number'; text: Txt; min: number; max: number; unit?: Txt }
  | { id: string; type: 'year'; text: Txt; min: number; max: number };

export type Section = { id: string; title: Txt; intro?: Txt; source?: string; items: Item[] };

const thisYear = new Date().getFullYear();

export const SURVEY: { id: string; version: number; minutes: number; sections: Section[] } = {
  id: 'baseline',
  version: 1,
  minutes: 5,
  sections: [
    {
      id: 'about',
      title: { de: 'Über dich', en: 'About you', pl: 'O Tobie' },
      items: [
        // Age via birth year. Minimum age for participation still to be agreed with the DSB.
        { id: 'birth_year', type: 'year', text: { de: 'In welchem Jahr bist du geboren?', en: 'What year were you born?', pl: 'W którym roku się urodziłeś(-aś)?' }, min: 1930, max: thisYear - 14 },
        {
          id: 'gender',
          type: 'single',
          text: { de: 'Geschlecht', en: 'Gender', pl: 'Płeć' },
          options: [
            { code: 'female', label: { de: 'weiblich', en: 'female', pl: 'kobieta' } },
            { code: 'male', label: { de: 'männlich', en: 'male', pl: 'mężczyzna' } },
            { code: 'diverse', label: { de: 'divers', en: 'diverse', pl: 'inna' } },
            { code: 'na', label: { de: 'keine Angabe', en: 'prefer not to say', pl: 'wolę nie podawać' } }
          ]
        },
        // Avidity (behavioural dimension of specialization).
        { id: 'days_12m', type: 'number', text: { de: 'An wie vielen Tagen hast du in den letzten 12 Monaten geangelt (ungefähr)?', en: 'About how many days did you go fishing in the last 12 months?', pl: 'Przez ile mniej więcej dni wędkowałeś(-aś) w ciągu ostatnich 12 miesięcy?' }, min: 0, max: 366, unit: { de: 'Tage', en: 'days', pl: 'dni' } }
      ]
    },
    {
      id: 'involvement',
      title: { de: 'Was dir das Angeln bedeutet', en: 'What fishing means to you', pl: 'Co znaczy dla Ciebie wędkarstwo' },
      intro: { de: 'Wie sehr stimmst du den folgenden Aussagen zu?', en: 'How much do you agree with the following statements?', pl: 'W jakim stopniu zgadzasz się z poniższymi stwierdzeniami?' },
      // Modified Involvement Scale: centrality and attraction subscales.
      source: 'Kyle, G., Absher, J., Norman, W., Hammitt, W., & Jodice, L. (2007). A modified involvement scale. Leisure Studies, 26(4), 399–427.',
      items: [
        { id: 'cent_1', type: 'likert', scale: 'agree5', text: { de: 'Ein großer Teil meines Lebens ist um das Angeln herum organisiert.', en: 'I find a lot of my life is organized around fishing.', pl: 'Duża część mojego życia jest zorganizowana wokół wędkarstwa.' } },
        { id: 'cent_2', type: 'likert', scale: 'agree5', text: { de: 'Das Angeln nimmt eine zentrale Rolle in meinem Leben ein.', en: 'Fishing occupies a central role in my life.', pl: 'Wędkarstwo zajmuje centralne miejsce w moim życiu.' } },
        { id: 'cent_3', type: 'likert', scale: 'agree5', text: { de: 'Das Angeln gegen eine andere Freizeitbeschäftigung zu tauschen, würde ein grundlegendes Umdenken erfordern.', en: 'To change my preference from fishing to another leisure activity would require major rethinking.', pl: 'Zamiana wędkarstwa na inną formę spędzania wolnego czasu wymagałaby ode mnie gruntownego przemyślenia.' } },
        { id: 'attr_1', type: 'likert', scale: 'agree5', text: { de: 'Angeln ist eine der schönsten Sachen, die ich mache.', en: 'Fishing is one of the most enjoyable things I do.', pl: 'Wędkarstwo to jedna z najprzyjemniejszych rzeczy, jakie robię.' } },
        { id: 'attr_2', type: 'likert', scale: 'agree5', text: { de: 'Angeln ist mir sehr wichtig.', en: 'Fishing is very important to me.', pl: 'Wędkarstwo jest dla mnie bardzo ważne.' } },
        { id: 'attr_3', type: 'likert', scale: 'agree5', text: { de: 'Angeln ist eine der befriedigendsten Sachen, die ich mache.', en: 'Fishing is one of the most satisfying things I do.', pl: 'Wędkarstwo to jedna z rzeczy, które dają mi najwięcej satysfakcji.' } }
      ]
    },
    {
      id: 'motives',
      title: { de: 'Warum du angelst', en: 'Why you fish', pl: 'Dlaczego wędkujesz' },
      intro: { de: 'Wie wichtig sind dir die folgenden Gründe fürs Angeln?', en: 'How important are the following reasons for going fishing to you?', pl: 'Jak ważne są dla Ciebie następujące powody wędkowania?' },
      // Short selection of fishing motive items.
      source: 'Fedler, A. J., & Ditton, R. B. (1994). Understanding angler motivations in fisheries management. Fisheries, 19(4), 6–13. (Short selection; original list is longer.)',
      items: [
        { id: 'mot_relax', type: 'likert', scale: 'importance5', text: { de: 'Um mich zu entspannen', en: 'To relax', pl: 'Żeby się zrelaksować' } },
        { id: 'mot_outdoors', type: 'likert', scale: 'importance5', text: { de: 'Um draußen zu sein', en: 'To be outdoors', pl: 'Żeby przebywać na świeżym powietrzu' } },
        { id: 'mot_nature', type: 'likert', scale: 'importance5', text: { de: 'Um die Natur zu erleben', en: 'To experience natural surroundings', pl: 'Żeby obcować z przyrodą' } },
        { id: 'mot_escape', type: 'likert', scale: 'importance5', text: { de: 'Um aus dem Alltag herauszukommen', en: 'To get away from the regular routine', pl: 'Żeby oderwać się od codzienności' } },
        { id: 'mot_friends', type: 'likert', scale: 'importance5', text: { de: 'Um Zeit mit Freunden zu verbringen', en: 'To be with friends', pl: 'Żeby spędzić czas z przyjaciółmi' } },
        { id: 'mot_family', type: 'likert', scale: 'importance5', text: { de: 'Um Zeit mit der Familie zu verbringen', en: 'For family recreation', pl: 'Żeby spędzić czas z rodziną' } },
        { id: 'mot_challenge', type: 'likert', scale: 'importance5', text: { de: 'Wegen der sportlichen Herausforderung', en: 'For the challenge or sport', pl: 'Dla sportowego wyzwania' } },
        { id: 'mot_skills', type: 'likert', scale: 'importance5', text: { de: 'Um meine Fähigkeiten zu verbessern', en: 'To develop my skills', pl: 'Żeby doskonalić swoje umiejętności' } },
        { id: 'mot_catch', type: 'likert', scale: 'importance5', text: { de: 'Wegen des Erlebnisses, einen Fisch zu fangen', en: 'For the experience of the catch', pl: 'Dla emocji związanych ze złowieniem ryby' } },
        { id: 'mot_eat', type: 'likert', scale: 'importance5', text: { de: 'Um Fisch zum Essen zu bekommen', en: 'To obtain fish for eating', pl: 'Żeby zdobyć ryby do jedzenia' } }
      ]
    },
    {
      id: 'catch',
      title: { de: 'Fangen und Behalten', en: 'Catching and keeping', pl: 'Łowienie i zabieranie ryb' },
      intro: { de: 'Wie sehr stimmst du den folgenden Aussagen zu?', en: 'How much do you agree with the following statements?', pl: 'W jakim stopniu zgadzasz się z poniższymi stwierdzeniami?' },
      // Catch orientation, four dimensions: catching something, numbers, size (trophy), keeping.
      source: 'Anderson, D. K., Ditton, R. B., & Hunt, K. M. (2007). Measuring angler attitudes toward catch-related aspects of fishing. Human Dimensions of Wildlife, 12(3), 181–191. Items marked reverse are reverse-coded in analysis.',
      items: [
        { id: 'co_some_1', type: 'likert', scale: 'agree5', reverse: true, text: { de: 'Ein Angeltag kann gelungen sein, auch wenn ich nichts fange.', en: 'A fishing trip can be successful even if no fish are caught.', pl: 'Dzień na rybach może być udany, nawet jeśli nic nie złowię.' } },
        { id: 'co_some_2', type: 'likert', scale: 'agree5', reverse: true, text: { de: 'Ich bin genauso zufrieden, wenn ich beim Angeln nichts fange.', en: "When I go fishing, I'm just as happy if I don't catch a fish.", pl: 'Kiedy idę na ryby, jestem tak samo zadowolony(-a), jeśli nic nie złowię.' } },
        { id: 'co_some_3', type: 'likert', scale: 'agree5', text: { de: 'Ich bin erst zufrieden, wenn ich mindestens einen Fisch fange.', en: "When I go fishing, I'm not satisfied unless I catch at least one fish.", pl: 'Kiedy idę na ryby, nie jestem zadowolony(-a), dopóki nie złowię przynajmniej jednej ryby.' } },
        { id: 'co_num_1', type: 'likert', scale: 'agree5', text: { de: 'Je mehr Fische ich fange, desto zufriedener bin ich.', en: 'The more fish I catch, the happier I am.', pl: 'Im więcej ryb złowię, tym bardziej jestem zadowolony(-a).' } },
        { id: 'co_num_2', type: 'likert', scale: 'agree5', text: { de: 'Ein Angeltag ist für mich am besten, wenn ich viele Fische fange.', en: 'A fishing trip is best for me when I catch a lot of fish.', pl: 'Wyprawa na ryby jest dla mnie najlepsza, gdy złowię dużo ryb.' } },
        { id: 'co_size_1', type: 'likert', scale: 'agree5', text: { de: 'Ich fange lieber ein oder zwei große Fische als zehn kleine.', en: "I'd rather catch 1 or 2 big fish than 10 smaller fish.", pl: 'Wolę złowić jedną lub dwie duże ryby niż dziesięć małych.' } },
        { id: 'co_size_2', type: 'likert', scale: 'agree5', text: { de: 'Ich angle gerne dort, wo ich die Chance auf einen kapitalen Fisch habe.', en: "I like to fish where I know I have a chance to catch a 'trophy' fish.", pl: 'Lubię łowić tam, gdzie mam szansę złowić rybę trofeową.' } },
        { id: 'co_size_3', type: 'likert', scale: 'agree5', text: { de: 'Je größer der Fisch, desto besser der Angeltag.', en: 'The bigger the fish I catch, the better the fishing trip.', pl: 'Im większą rybę złowię, tym lepsza wyprawa na ryby.' } },
        { id: 'co_keep_1', type: 'likert', scale: 'agree5', text: { de: 'Ich esse die Fische, die ich fange, normalerweise selbst.', en: 'I usually eat the fish I catch.', pl: 'Zazwyczaj zjadam ryby, które złowię.' } },
        { id: 'co_keep_2', type: 'likert', scale: 'agree5', reverse: true, text: { de: 'Ich bin zufriedener, wenn ich die gefangenen Fische zurücksetze.', en: "I'm happier if I release the fish I catch.", pl: 'Jestem bardziej zadowolony(-a), gdy wypuszczam złowione ryby.' } },
        { id: 'co_keep_3', type: 'likert', scale: 'agree5', text: { de: 'Ich möchte alle Fische behalten, die ich fangen darf.', en: 'I want to keep all the fish I am allowed to keep.', pl: 'Chcę zabierać wszystkie ryby, które wolno mi zabrać.' } }
      ]
    },
    {
      id: 'oder',
      title: { de: 'Die Oder', en: 'The Oder', pl: 'Odra' },
      // Project-specific, not a validated scale. Remove or adapt as needed.
      items: [
        {
          id: 'oder_before_2022',
          type: 'single',
          text: { de: 'Hast du vor dem Fischsterben im August 2022 an der Oder geangelt?', en: 'Did you fish the Oder before the fish kill in August 2022?', pl: 'Czy wędkowałeś(-aś) na Odrze przed masowym śnięciem ryb w sierpniu 2022 r.?' },
          options: [
            { code: 'regularly', label: { de: 'ja, regelmäßig', en: 'yes, regularly', pl: 'tak, regularnie' } },
            { code: 'sometimes', label: { de: 'ja, ab und zu', en: 'yes, occasionally', pl: 'tak, od czasu do czasu' } },
            { code: 'no', label: { de: 'nein', en: 'no', pl: 'nie' } }
          ]
        },
        {
          id: 'oder_change',
          type: 'single',
          text: { de: 'Wie oft angelst du heute an der Oder im Vergleich zu vor 2022?', en: 'How often do you fish the Oder today compared to before 2022?', pl: 'Jak często wędkujesz dziś na Odrze w porównaniu z okresem przed 2022 r.?' },
          options: [
            { code: 'stopped', label: { de: 'gar nicht mehr', en: 'not at all anymore', pl: 'wcale już nie' } },
            { code: 'less', label: { de: 'seltener', en: 'less often', pl: 'rzadziej' } },
            { code: 'same', label: { de: 'gleich oft', en: 'about the same', pl: 'tak samo często' } },
            { code: 'more', label: { de: 'öfter', en: 'more often', pl: 'częściej' } },
            { code: 'na', label: { de: 'trifft nicht zu', en: 'does not apply', pl: 'nie dotyczy' } }
          ]
        }
      ]
    }
  ]
};

export const allItems = () => SURVEY.sections.flatMap((s) => s.items);
