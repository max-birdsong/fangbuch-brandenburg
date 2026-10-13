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
// German versions used in IGB/IfB angler surveys) before fielding.
// =====================================================================================

export type Txt = { de: string; en: string };

export type Scale = { points: Txt[] }; // 1..n, stored as numbers 1..n

export const SCALES = {
  agree5: {
    points: [
      { de: 'stimme überhaupt nicht zu', en: 'strongly disagree' },
      { de: 'stimme eher nicht zu', en: 'disagree' },
      { de: 'teils/teils', en: 'neutral' },
      { de: 'stimme eher zu', en: 'agree' },
      { de: 'stimme voll zu', en: 'strongly agree' }
    ]
  },
  importance5: {
    points: [
      { de: 'überhaupt nicht wichtig', en: 'not at all important' },
      { de: 'wenig wichtig', en: 'slightly important' },
      { de: 'mittelmäßig wichtig', en: 'moderately important' },
      { de: 'sehr wichtig', en: 'very important' },
      { de: 'extrem wichtig', en: 'extremely important' }
    ]
  },
  skill5: {
    points: [
      { de: 'viel schlechter', en: 'much less skilled' },
      { de: 'etwas schlechter', en: 'somewhat less skilled' },
      { de: 'etwa gleich', en: 'about the same' },
      { de: 'etwas besser', en: 'somewhat more skilled' },
      { de: 'viel besser', en: 'much more skilled' }
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
      title: { de: 'Über dich', en: 'About you' },
      items: [
        // Age via birth year. Minimum age for participation still to be agreed with the DSB.
        { id: 'birth_year', type: 'year', text: { de: 'In welchem Jahr bist du geboren?', en: 'What year were you born?' }, min: 1930, max: thisYear - 14 },
        {
          id: 'gender',
          type: 'single',
          text: { de: 'Geschlecht', en: 'Gender' },
          options: [
            { code: 'female', label: { de: 'weiblich', en: 'female' } },
            { code: 'male', label: { de: 'männlich', en: 'male' } },
            { code: 'diverse', label: { de: 'divers', en: 'diverse' } },
            { code: 'na', label: { de: 'keine Angabe', en: 'prefer not to say' } }
          ]
        },
        // Avidity (behavioural dimension of specialization).
        { id: 'days_12m', type: 'number', text: { de: 'An wie vielen Tagen hast du in den letzten 12 Monaten geangelt (ungefähr)?', en: 'About how many days did you go fishing in the last 12 months?' }, min: 0, max: 366, unit: { de: 'Tage', en: 'days' } },
        // Self-rated skill (cognitive dimension of specialization), cf. Beardmore et al. 2013.
        { id: 'skill_self', type: 'likert', scale: 'skill5', text: { de: 'Wie schätzt du deine Fähigkeiten beim Angeln im Vergleich zu anderen Anglerinnen und Anglern ein?', en: 'How would you rate your fishing skills compared to other anglers?' } }
      ]
    },
    {
      id: 'involvement',
      title: { de: 'Was dir das Angeln bedeutet', en: 'What fishing means to you' },
      intro: { de: 'Wie sehr stimmst du den folgenden Aussagen zu?', en: 'How much do you agree with the following statements?' },
      // Modified Involvement Scale: centrality and attraction subscales.
      source: 'Kyle, G., Absher, J., Norman, W., Hammitt, W., & Jodice, L. (2007). A modified involvement scale. Leisure Studies, 26(4), 399–427.',
      items: [
        { id: 'cent_1', type: 'likert', scale: 'agree5', text: { de: 'Ein großer Teil meines Lebens ist um das Angeln herum organisiert.', en: 'I find a lot of my life is organized around fishing.' } },
        { id: 'cent_2', type: 'likert', scale: 'agree5', text: { de: 'Das Angeln nimmt eine zentrale Rolle in meinem Leben ein.', en: 'Fishing occupies a central role in my life.' } },
        { id: 'cent_3', type: 'likert', scale: 'agree5', text: { de: 'Das Angeln gegen eine andere Freizeitbeschäftigung zu tauschen, würde ein grundlegendes Umdenken erfordern.', en: 'To change my preference from fishing to another leisure activity would require major rethinking.' } },
        { id: 'attr_1', type: 'likert', scale: 'agree5', text: { de: 'Angeln ist eine der schönsten Sachen, die ich mache.', en: 'Fishing is one of the most enjoyable things I do.' } },
        { id: 'attr_2', type: 'likert', scale: 'agree5', text: { de: 'Angeln ist mir sehr wichtig.', en: 'Fishing is very important to me.' } },
        { id: 'attr_3', type: 'likert', scale: 'agree5', text: { de: 'Angeln ist eine der befriedigendsten Sachen, die ich mache.', en: 'Fishing is one of the most satisfying things I do.' } }
      ]
    },
    {
      id: 'motives',
      title: { de: 'Warum du angelst', en: 'Why you fish' },
      intro: { de: 'Wie wichtig sind dir die folgenden Gründe fürs Angeln?', en: 'How important are the following reasons for going fishing to you?' },
      // Short selection of fishing motive items.
      source: 'Fedler, A. J., & Ditton, R. B. (1994). Understanding angler motivations in fisheries management. Fisheries, 19(4), 6–13. (Short selection; original list is longer.)',
      items: [
        { id: 'mot_relax', type: 'likert', scale: 'importance5', text: { de: 'Um mich zu entspannen', en: 'To relax' } },
        { id: 'mot_outdoors', type: 'likert', scale: 'importance5', text: { de: 'Um draußen zu sein', en: 'To be outdoors' } },
        { id: 'mot_nature', type: 'likert', scale: 'importance5', text: { de: 'Um die Natur zu erleben', en: 'To experience natural surroundings' } },
        { id: 'mot_escape', type: 'likert', scale: 'importance5', text: { de: 'Um aus dem Alltag herauszukommen', en: 'To get away from the regular routine' } },
        { id: 'mot_friends', type: 'likert', scale: 'importance5', text: { de: 'Um Zeit mit Freunden zu verbringen', en: 'To be with friends' } },
        { id: 'mot_family', type: 'likert', scale: 'importance5', text: { de: 'Um Zeit mit der Familie zu verbringen', en: 'For family recreation' } },
        { id: 'mot_challenge', type: 'likert', scale: 'importance5', text: { de: 'Wegen der sportlichen Herausforderung', en: 'For the challenge or sport' } },
        { id: 'mot_skills', type: 'likert', scale: 'importance5', text: { de: 'Um meine Fähigkeiten zu verbessern', en: 'To develop my skills' } },
        { id: 'mot_catch', type: 'likert', scale: 'importance5', text: { de: 'Wegen des Erlebnisses, einen Fisch zu fangen', en: 'For the experience of the catch' } },
        { id: 'mot_eat', type: 'likert', scale: 'importance5', text: { de: 'Um Fisch zum Essen zu bekommen', en: 'To obtain fish for eating' } }
      ]
    },
    {
      id: 'catch',
      title: { de: 'Fangen und Behalten', en: 'Catching and keeping' },
      intro: { de: 'Wie sehr stimmst du den folgenden Aussagen zu?', en: 'How much do you agree with the following statements?' },
      // Catch orientation, four dimensions: catching something, numbers, size (trophy), keeping.
      source: 'Anderson, D. K., Ditton, R. B., & Hunt, K. M. (2007). Measuring angler attitudes toward catch-related aspects of fishing. Human Dimensions of Wildlife, 12(3), 181–191. Items marked reverse are reverse-coded in analysis.',
      items: [
        { id: 'co_some_1', type: 'likert', scale: 'agree5', reverse: true, text: { de: 'Ein Angeltag kann gelungen sein, auch wenn ich nichts fange.', en: 'A fishing trip can be successful even if no fish are caught.' } },
        { id: 'co_some_2', type: 'likert', scale: 'agree5', reverse: true, text: { de: 'Ich bin genauso zufrieden, wenn ich beim Angeln nichts fange.', en: "When I go fishing, I'm just as happy if I don't catch a fish." } },
        { id: 'co_some_3', type: 'likert', scale: 'agree5', text: { de: 'Ich bin erst zufrieden, wenn ich mindestens einen Fisch fange.', en: "When I go fishing, I'm not satisfied unless I catch at least one fish." } },
        { id: 'co_num_1', type: 'likert', scale: 'agree5', text: { de: 'Je mehr Fische ich fange, desto zufriedener bin ich.', en: 'The more fish I catch, the happier I am.' } },
        { id: 'co_num_2', type: 'likert', scale: 'agree5', text: { de: 'Ein Angeltag ist für mich am besten, wenn ich viele Fische fange.', en: 'A fishing trip is best for me when I catch a lot of fish.' } },
        { id: 'co_size_1', type: 'likert', scale: 'agree5', text: { de: 'Ich fange lieber ein oder zwei große Fische als zehn kleine.', en: "I'd rather catch 1 or 2 big fish than 10 smaller fish." } },
        { id: 'co_size_2', type: 'likert', scale: 'agree5', text: { de: 'Ich angle gerne dort, wo ich die Chance auf einen kapitalen Fisch habe.', en: "I like to fish where I know I have a chance to catch a 'trophy' fish." } },
        { id: 'co_size_3', type: 'likert', scale: 'agree5', text: { de: 'Je größer der Fisch, desto besser der Angeltag.', en: 'The bigger the fish I catch, the better the fishing trip.' } },
        { id: 'co_keep_1', type: 'likert', scale: 'agree5', text: { de: 'Ich esse die Fische, die ich fange, normalerweise selbst.', en: 'I usually eat the fish I catch.' } },
        { id: 'co_keep_2', type: 'likert', scale: 'agree5', reverse: true, text: { de: 'Ich bin zufriedener, wenn ich die gefangenen Fische zurücksetze.', en: "I'm happier if I release the fish I catch." } },
        { id: 'co_keep_3', type: 'likert', scale: 'agree5', text: { de: 'Ich möchte alle Fische behalten, die ich fangen darf.', en: 'I want to keep all the fish I am allowed to keep.' } }
      ]
    },
    {
      id: 'oder',
      title: { de: 'Die Oder', en: 'The Oder' },
      // Project-specific, not a validated scale. Remove or adapt as needed.
      items: [
        {
          id: 'oder_before_2022',
          type: 'single',
          text: { de: 'Hast du vor dem Fischsterben im August 2022 an der Oder geangelt?', en: 'Did you fish the Oder before the fish kill in August 2022?' },
          options: [
            { code: 'regularly', label: { de: 'ja, regelmäßig', en: 'yes, regularly' } },
            { code: 'sometimes', label: { de: 'ja, ab und zu', en: 'yes, occasionally' } },
            { code: 'no', label: { de: 'nein', en: 'no' } }
          ]
        },
        {
          id: 'oder_change',
          type: 'single',
          text: { de: 'Wie oft angelst du heute an der Oder im Vergleich zu vor 2022?', en: 'How often do you fish the Oder today compared to before 2022?' },
          options: [
            { code: 'stopped', label: { de: 'gar nicht mehr', en: 'not at all anymore' } },
            { code: 'less', label: { de: 'seltener', en: 'less often' } },
            { code: 'same', label: { de: 'gleich oft', en: 'about the same' } },
            { code: 'more', label: { de: 'öfter', en: 'more often' } },
            { code: 'na', label: { de: 'trifft nicht zu', en: 'does not apply' } }
          ]
        }
      ]
    }
  ]
};

export const allItems = () => SURVEY.sections.flatMap((s) => s.items);
