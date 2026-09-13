import type { CommunityRecord } from './community';

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'")
    .toLowerCase();
const TOPICS: [string, RegExp][] = [
  [
    'Food',
    /\b(food|dish(?:es)?|meals?|plates?|portions?|steaks?|ribeyes?|fillets?|tenderloin|burgers?|sandwich\w*|pasta|risotto|ravioli|gnocchi|lasagn\w*|pizzas?|sushi|sashimi|nigiri|rolls?|meat|beef|chicken|lamb|duck|fish|seafood|salmon|tuna|prawns?|shrimp|calamari|octopus|salads?|soups?|bread|fries|chips|potatoes|vegetables|sauces?|desserts?|tiramisu|cheesecake|cakes?|ice cream|breakfast|lunch|dinner|menu|kitchen|chef|cooking|cuisine|ushqim\w*|gatim\w*|mish\w*|peshk\w*|embelsir\w*|cibo|piatt\w*|carne|pesce|cucina)\b/i,
  ],
  [
    'Drinks',
    /\b(drinks?|beverages?|cocktails?|mocktails?|wine|wines|beer|coffee|coffees|espresso|cappuccino|latte|tea|juice|water|whisk(?:e)?y|vodka|gin|rum|tequila|aperol|spritz|negroni|mojito|martini|margaritas?|prosecco|champagne|lemonade|smoothies?|bottles?|pije\w*|kafe\w*|koktej\w*|vere|vera|birr\w*|bevande|vino|caffe)\b/i,
  ],
  [
    'Service',
    /\b(service|staff|waiters?|waitress\w*|servers?|bartenders?|bar tenders?|hosts?|hostess\w*|manager\w*|management|security|reception\w*|bouncers?|employees?|personnel|sherbim\w*|staf\w*|kamerier\w*|servizio|personale|camerier\w*)\b/i,
  ],
  [
    'Waiting time',
    /\b(wait(?:s|ed|ing)?|delay\w*|minutes?|hours?|vones\w*|prit\w*|attesa)\b/i,
  ],
  [
    'Price & value',
    /\b(price\w*|bill|parking|cost\w*|value|charged?|charges|expensive|overpriced|shtrenjt\w*|cmim\w*|prezz\w*|conto)\b/i,
  ],
  [
    'Atmosphere',
    /\b(atmosphere|music|dj|speakers?|noise|noisy|loud|ambien\w*|decor|lighting|lights|seating|chairs?|tables?|terrace|smok\w*|cigarettes?|ventilation|crowd\w*|muzik\w*|zhurm\w*|rumore)\b/i,
  ],
  [
    'Cleanliness',
    /\b(clean\w*|dirty|hygiene|toilet\w*|bathrooms?|restrooms?|cutlery|glasses|sticky|filthy|pist\w*|paster\w*|sporco|sporca|pulizi\w*)\b/i,
  ],
];
const NEGATIVE =
  /\b(bad|poor|terrible|awful|disappoint\w*|cold|raw|burnt|overcook\w*|undercook\w*|salty|bland|tasteless|stale|greasy|watery|diluted|mediocre|leftover|falling apart|not worth|no taste|limited|unavailable|rude|slow|dirty|overpriced|expensive|noisy|loud|wrong|forgot\w*|unfriendly|unhelpful|worst|unpleasant|miserable|inedible|rubbery|soggy|chewy|tough|dry|tiny|lukewarm|spoiled|sour|burned|keq\w*|ftoh\w*|shtrenjt\w*|pist\w*|vones\w*|dobet|pessim\w*|cattiv\w*|fredd\w*|crudo|bruciat\w*|sporco|sporca|scortese|lento|lenta|not (?:fresh|good|tasty|friendly|attentive|clean|welcoming|cooked|warm)|no flavou?r)\b/i;
const IMPLICIT: [string, RegExp][] = [
  [
    'Food',
    /\b(?:tastes? like (?:cardboard|rubber|nothing)|(?:could(?:n't| not)|unable to) (?:cut|chew|eat|finish) (?:it|this|the)|(?:too much|excessive) (?:salt|oil)|(?:frozen|raw) (?:inside|in the middle)|(?:hair|insect|fly) in (?:my|the|our) (?:plate|meal|dish|soup)|sent (?:it|the (?:dish|meal|plate)) back|(?:portion\w*|serving\w*) (?:were|was|are|is|felt)?\s*(?:tiny|small|stingy)|(?:made|left) (?:me|us) (?:sick|ill))\b/i,
  ],
  [
    'Drinks',
    /\b(?:all ice (?:and|with) (?:no|hardly)|(?:mostly|just|too much) ice|(?:no|hardly any) alcohol|(?:watered|water) down|flat (?:beer|prosecco|champagne)|(?:coffee|espresso) (?:tasted|tastes) burnt)\b/i,
  ],
  [
    'Service',
    /\b(?:ignored (?:us|me|our)|(?:nobody|no one) (?:greeted|helped|acknowledged|served|came)|(?:rolled? (?:his|her|their) eyes)|(?:dismissive|arrogant|disrespectful|unprofessional|condescending)|(?:refused|would(?:n't| not)) to (?:help|serve|apologize|apologise)|(?:order|reservation) (?:was )?(?:lost|forgotten)|(?:brought|served|delivered) (?:us |me )?(?:the )?wrong|(?:never|did(?:n't| not)) (?:arrive|came|bring|check on)|(?:treated|treating) (?:us|me) (?:badly|like (?:an? )?inconvenience))\b/i,
  ],
  [
    'Waiting time',
    /\b(?:wait(?:ed|ing)? (?:for )?(?:over |almost |about )?(?:[2-9]\d|\d{3,}) minutes|(?:wait(?:ed|ing)?|took) (?:for )?(?:an? |one |two |three |\d+ )hours?|forever to (?:arrive|order|pay|be served)|(?:took|takes) forever|still waiting|long wait)\b/i,
  ],
  [
    'Atmosphere',
    /\b(?:(?:could(?:n't| not)|can't|cannot) (?:hear|talk|have a conversation)|(?:shout|shouting) (?:over|to be heard)|(?:smelled|smells|smelt) (?:of|like) (?:smoke|an? ashtray)|(?:too|extremely) (?:dark|bright|crowded|cramped|hot|loud|noisy)|uncomfortable (?:chairs|seats|seating)|deafening)\b/i,
  ],
  [
    'Cleanliness',
    /\b(?:sticky (?:tables|floor|cutlery)|filthy|unwashed|stained (?:glasses|plates)|(?:toilet|bathroom|restroom) (?:smelled|stank)|(?:flies|cockroaches|insects) (?:everywhere|around))\b/i,
  ],
  [
    'Price & value',
    /\b(?:overcharged|charged twice|hidden (?:charges|fees)|(?:not|wasn't) worth (?:the|that|its)|rip off|ripoff|bill (?:was )?wrong|incorrect bill)\b/i,
  ],
];

export function classifyReview(review: CommunityRecord) {
  const text = review.text.startsWith('(Translated by Google)')
    ? review.text.split('(Original)')[0]
    : review.text;
  const categories = new Set(
    TOPICS.filter(([, re]) => re.test(normalize(text))).map(([topic]) => topic),
  );
  const criticisms: { topic: string; excerpt: string }[] = [];
  let previous: { topic: string; sentence: string } | undefined;
  const add = (topic: string, excerpt: string) => {
    categories.add(topic);
    if (!criticisms.some((c) => c.topic === topic))
      criticisms.push({ topic, excerpt: excerpt.trim().slice(0, 700) });
  };
  for (const sentence of text.split(
    /(?<=[.!?,;\n])\s+|\b(?:but|however|although|whereas|yet|por|ma)\b/i,
  )) {
    const raw = normalize(sentence);
    // Suppress explicitly negated complaints, while retaining "not fresh" etc.
    const check = raw.replace(
      /\b(?:not|never|without|wasn't|weren't|isn't|aren't)\s+(?:(?:very|at all|too|so|particularly)\s+)?(?:bad|expensive|slow|dirty|rude|unfriendly|noisy|loud|cold|disappoint\w*)\b|\bno (?:complaints|delays?)\b|\bslow (?:down|motion)\b|\bpa vones\w*|\b(?:not|never|weren't|wasn't)\s+(?:ignored|dismissive|arrogant|overcharged)\b/gi,
      '',
    );
    const mentions = TOPICS.flatMap(([topic, re]) =>
      [...check.matchAll(new RegExp(re.source, 'gi'))].map((m) => ({
        topic,
        index: m.index!,
      })),
    );
    const explicitTopics = [...new Set(mentions.map((m) => m.topic))];
    // Mixed reviews often express disappointment without a blunt negative adjective.
    if (/\b(?:basic fare|(?:food|pizza|cocktails?) (?:is|are|was|were) (?:very )?basic|nothing exceptional|not much variety|(?:didn't|did not|doesn't|does not) (?:quite )?meet (?:our|my|the) expectations)\b/.test(check)) {
      const subject = explicitTopics.filter((t) => t === 'Food' || t === 'Drinks');
      for (const topic of subject) add(topic, sentence);
    }
    const context =
      explicitTopics.length === 0 &&
      /^\s*(?:it|they|these|this|that|both)\b/i.test(check)
        ? previous
        : undefined;
    for (const [topic, pattern] of IMPLICIT)
      if (pattern.test(check))
        add(topic, context ? context.sentence + ' ' + sentence : sentence);
    for (const negative of check.matchAll(new RegExp(NEGATIVE.source, 'gi'))) {
      const closest = mentions
        .map((m) => ({ ...m, distance: Math.abs(m.index - negative.index!) }))
        .filter((m) => m.distance <= 90)
        .sort((a, b) => a.distance - b.distance)[0];
      let topic = closest?.topic || context?.topic;
      if (!topic && /^(rude|unfriendly|unhelpful|scortese)$/i.test(negative[0]))
        topic = 'Service';
      if (
        !topic &&
        /^(raw|burnt|undercook\w*|overcook\w*|inedible|soggy|rubbery|tasteless|greasy)$/i.test(
          negative[0],
        )
      )
        topic = 'Food';
      if (
        topic === 'Drinks' &&
        /^(cold|dry|sour|raw)$/i.test(negative[0]) &&
        !/\btoo (?:cold|dry|sour)\b/.test(check)
      )
        continue;
      if (
        topic === 'Atmosphere' &&
        /^(loud|noisy)$/i.test(negative[0]) &&
        /\b(?:love|loved|enjoy|enjoyed)\b/.test(check)
      )
        continue;
      if (topic)
        add(topic, context ? context.sentence + ' ' + sentence : sentence);
      if (/^(slow|lento|lenta)$/i.test(negative[0]))
        add('Waiting time', sentence);
      if (
        topic === 'Price & value' &&
        /^(overpriced|expensive)$/i.test(negative[0])
      ) {
        const subject = mentions
          .filter((m) => m.index !== negative.index)
          .map((m) => ({ ...m, distance: Math.abs(m.index - negative.index!) }))
          .filter((m) => m.distance <= 60)
          .sort((a, b) => a.distance - b.distance)[0];
        if (subject && ['Food', 'Drinks'].includes(subject.topic))
          add(subject.topic, sentence);
      }
    }
    // Carry one unambiguous subject into the immediately following pronoun clause only.
    previous =
      explicitTopics.length === 1
        ? { topic: explicitTopics[0], sentence: sentence.trim() }
        : undefined;
  }
  return {
    categories: categories.size ? [...categories] : ['Other'],
    criticisms,
  };
}
