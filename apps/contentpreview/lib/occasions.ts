export const OCCASION_START = '2026-09-01';
export const OCCASION_END = '2028-01-01';
export const OCCASION_REVIEWED = '2026-09-10';
export const occasionCategories = ['National & local', 'Food', 'Drinks', 'Music & culture', 'Community', 'Faith', 'Seasonal'] as const;
export type OccasionCategory = typeof occasionCategories[number];
export type Occasion = { id: string; date: string; endDate?: string; title: string; category: OccasionCategory; region: string; status: 'Annual observance' | 'Informal occasion' | 'Confirmed dates' | 'Tentative'; idea: string; source: string };
const kosovo = 'https://www.timeanddate.com/holidays/kosovo/2027';
const albania = 'https://www.bankofalbania.org/Press/2026_Official_Bank_Holiday_Schedule/';
const un = 'https://www.un.org/en/observances/list-days-weeks';
const unesco = 'https://www.unesco.org/en/days';
const fun = 'https://www.timeanddate.com/holidays/fun/';
const drinks = 'https://www.diffordsguide.com/on-this-day';
type Annual = [string, string, OccasionCategory, string, string, string, boolean?];
// Dates describe the occasion itself, not substitute bank-closure days.
const annual: Annual[] = [
  ['01-01', 'New Year’s Day', 'Seasonal', 'Kosovo · Albania · International', 'Welcome the year with a warm Society message and a relaxed lunch invitation.', kosovo],
  ['01-02', 'Second day of New Year', 'National & local', 'Kosovo · Albania', 'A slower gathering for friends still home for the holidays.', kosovo],
  ['01-07', 'Orthodox Christmas', 'Faith', 'Kosovo · Orthodox communities', 'Offer thoughtful greetings and a family table; avoid assuming every guest observes it.', kosovo],
  ['01-12', 'Marzipan Day', 'Food', 'International inspiration', 'A close-up of almond textures from the pastry kitchen.', fun, true],
  ['01-19', 'Popcorn Day', 'Food', 'International inspiration', 'Consider a playful bar snack or a film-night pairing.', fun, true],
  ['01-22', 'Hot Sauce Day', 'Food', 'International inspiration', 'Let the Asian kitchen explain its heat, chilli and balance.', fun, true],
  ['01-27', 'Chocolate Cake Day', 'Food', 'International inspiration', 'Photograph a plated chocolate dessert in warm, low light.', fun, true],
  ['01-30', 'Croissant Day', 'Food', 'International inspiration', 'Morning coffee, pastry layers and quiet hospitality.', fun, true],
  ['02-02', 'Day of the Crêpe', 'Food', 'France · International inspiration', 'A delicate dessert special with seasonal citrus.', fun, true],
  ['02-05', 'Chocolate Fondue Day', 'Food', 'International inspiration', 'A dessert to share for the lead-up to Valentine’s.', fun, true],
  ['02-13', 'World Radio Day', 'Music & culture', 'International', 'Share the tracks that shape the sound of Ysabel.', unesco],
  ['02-14', 'Valentine’s Day', 'Seasonal', 'International', 'A considered dinner for two, candlelight and reservation-led storytelling.', 'https://www.timeanddate.com/holidays/albania/2027'],
  ['02-17', 'Kosovo Independence Day', 'National & local', 'Kosovo', 'Celebrate home, local talent and the people around our tables.', kosovo],
  ['02-26', 'Pistachio Day', 'Food', 'International inspiration', 'Feature a pistachio dessert or ingredient detail from the Italian kitchen.', fun, true],
  ['03-01', 'World Compliment Day', 'Community', 'International inspiration', 'Invite guests to name someone who makes their nights better.', fun, true],
  ['03-08', 'International Women’s Day / local Mother’s Day', 'Community', 'Kosovo · Albania · International', 'Celebrate women in the team and community; invite meaningful family gatherings.', 'https://www.timeanddate.com/holidays/albania/2027'],
  ['03-14', 'Dita e Verës — Summer Day', 'National & local', 'Albania', 'Welcome renewal with greenery, bright dishes and an Albanian cultural note.', albania],
  ['03-17', 'St Patrick’s Day', 'Seasonal', 'Ireland · International inspiration', 'An optional Irish whiskey or live-music story for adult guests.', 'https://www.timeanddate.com/holidays/ireland/st-patrick-day'],
  ['03-20', 'International Day of Happiness', 'Community', 'International', 'A candid moment of friends reconnecting around a table.', un],
  ['03-21', 'World Poetry Day', 'Music & culture', 'International', 'A short Albanian verse or original words paired with a still-life photograph.', unesco],
  ['03-22', 'Nevruz', 'Faith', 'Albania · Bektashi communities', 'A respectful message of renewal and togetherness.', albania],
  ['03-22', 'World Water Day', 'Community', 'International', 'Share a real water-saving practice from the kitchen.', un],
  ['04-06', 'International Day of Sport for Development and Peace', 'Community', 'International', 'Celebrate local sporting communities over a shared meal.', un],
  ['04-09', 'Kosovo Constitution Day', 'National & local', 'Kosovo', 'A restrained message about belonging and our shared home.', kosovo],
  ['04-15', 'World Art Day', 'Music & culture', 'International', 'Feature the artwork, materials and visual details inside Ysabel.', unesco],
  ['04-22', 'International Mother Earth Day', 'Community', 'International', 'Show seasonal sourcing and the people growing our ingredients.', un],
  ['04-23', 'World Book and Copyright Day', 'Music & culture', 'International', 'Books, an afternoon coffee and a quiet corner of Society.', unesco],
  ['04-29', 'International Dance Day', 'Music & culture', 'International', 'Build anticipation for the movement and energy of a DJ night.', 'https://www.international-dance-day.org/'],
  ['04-30', 'International Jazz Day', 'Music & culture', 'International', 'Consider a jazz-led dinner or a listening session.', 'https://www.unesco.org/en/international-jazz-day'],
  ['05-01', 'International Workers’ Day', 'National & local', 'Kosovo · Albania', 'Thank the chefs, hosts, bartenders and behind-the-scenes team.', kosovo],
  ['05-09', 'Europe Day', 'National & local', 'Kosovo · Europe', 'A table bringing European culinary influences together.', kosovo],
  ['05-13', 'World Cocktail Day', 'Drinks', 'International', 'A signature serve, precise technique and a bartender portrait.', 'https://www.diffordsguide.com/on-this-day/may/13', true],
  ['05-15', 'International Day of Families', 'Community', 'International', 'A generous shared-table story and family reservations.', un],
  ['05-20', 'World Bee Day', 'Food', 'International', 'Show local honey and the producer behind it.', un],
  ['05-21', 'International Tea Day', 'Drinks', 'International', 'Explore tea rituals, Asian pairings and alcohol-free serves.', un],
  ['05-21', 'World Day for Cultural Diversity', 'Music & culture', 'International', 'Connect Asian and Italian influences through the people cooking them.', un],
  ['06-01', 'Global Day of Parents', 'Community', 'International', 'Invite guests to make time for a meal with their parents.', un],
  ['06-05', 'World Environment Day', 'Community', 'International', 'Tell one specific, honest story about reducing waste.', un],
  ['06-07', 'World Food Safety Day', 'Food', 'International', 'A behind-the-scenes look at kitchen care and craft.', un],
  ['06-08', 'World Oceans Day', 'Food', 'International', 'Discuss responsible seafood choices with the Asian chef.', un],
  ['06-12', 'Kosovo Peace / Liberation Day', 'National & local', 'Kosovo', 'A thoughtful local message centred on peace and community.', kosovo],
  ['06-18', 'Sustainable Gastronomy Day', 'Food', 'International', 'Introduce a seasonal ingredient through its farmer, chef and finished plate.', 'https://www.fao.org/sustainable-gastronomy-day/en'],
  ['06-18', 'International Sushi Day', 'Food', 'International inspiration', 'A focused sushi sequence: ingredient, knife work, plating and the first bite.', 'https://en.wikipedia.org/wiki/List_of_food_days', true],
  ['06-21', 'Fête de la Musique / World Music Day', 'Music & culture', 'International', 'Celebrate the resident DJs and invite the community to listen together.', 'https://fetedelamusique.culture.gouv.fr/'],
  ['07-07', 'World Chocolate Day', 'Food', 'International inspiration', 'Deep chocolate tones, pastry craft and an Italian dessert pairing.', 'https://en.wikipedia.org/wiki/World_Chocolate_Day', true],
  ['07-11', 'Mojito Day', 'Drinks', 'US-origin · International inspiration', 'Fresh mint, ice and a summer Garden serve.', 'https://www.diffordsguide.com/on-this-day/july', true],
  ['07-24', 'Tequila Day', 'Drinks', 'US-origin · International inspiration', 'An agave tasting story for adult guests, with considered food pairings.', 'https://www.diffordsguide.com/on-this-day/july', true],
  ['07-30', 'International Day of Friendship', 'Community', 'International', 'Ask guests who they have been meaning to invite back.', un],
  ['08-12', 'International Youth Day', 'Community', 'International', 'Spotlight emerging local creative talent without alcohol-led messaging.', un],
  ['09-05', 'Saint Teresa Sanctification Day', 'National & local', 'Albania', 'A quiet message of generosity or a concrete community initiative.', albania],
  ['09-12', 'Chocolate Milkshake Day', 'Food', 'International inspiration', 'A playful alcohol-free dessert drink with polished photography.', fun, true],
  ['09-21', 'International Day of Peace', 'Community', 'International', 'A reflective community message; keep the tone thoughtful.', un],
  ['09-27', 'World Tourism Day', 'Community', 'International', 'Introduce Prishtina through Ysabel’s people, flavours and hospitality.', un],
  ['09-29', 'Food Loss and Waste Awareness Day', 'Food', 'International', 'Share a genuine kitchen practice that puts more of each ingredient to use.', un],
  ['10-01', 'International Coffee Day', 'Drinks', 'International', 'Coffee preparation, morning light and the ritual of a familiar table.', 'https://www.ico.org/documents/cy2024-25/pr-362e-international-coffee-day-2025.pdf'],
  ['10-16', 'World Food Day', 'Food', 'International', 'A shared-table story honouring ingredients and the people who produce them.', 'https://www.fao.org/world-food-day/en'],
  ['10-19', 'International Gin & Tonic Day', 'Drinks', 'International inspiration', 'A minimal gin-and-tonic portrait with a seasonal botanical garnish.', 'https://www.agtda.org/gineology', true],
  ['10-25', 'World Pasta Day', 'Food', 'International', 'Make the Italian kitchen the hero: fresh pasta, hands and a finished plate.', 'https://www.worldpastaday.org/'],
  ['10-31', 'Halloween', 'Seasonal', 'International inspiration', 'A restrained dark-toned dinner or music concept, with reservations confirmed first.', 'https://www.timeanddate.com/holidays/common/halloween'],
  ['11-22', 'Albanian Alphabet Day', 'National & local', 'Albania · Albanian communities', 'An Albanian-language caption celebrating words, identity and connection.', albania],
  ['11-28', 'Albanian Flag & Independence Day', 'National & local', 'Albania · Kosovo communities', 'An elegant red-and-black visual direction and local cultural storytelling.', albania],
  ['11-29', 'Albania Liberation Day', 'National & local', 'Albania', 'A respectful greeting and a gathering-focused invitation.', albania],
  ['12-05', 'International Volunteer Day', 'Community', 'International', 'Recognise people supporting the local community with concrete actions.', un],
  ['12-08', 'Albanian National Youth Day', 'National & local', 'Albania', 'A portrait series of emerging artists, chefs and creatives.', albania],
  ['12-24', 'Christmas Eve', 'Faith', 'Christian communities', 'Candlelight, seasonal menus and warm greetings for those celebrating.', 'https://www.timeanddate.com/holidays/albania/2027'],
  ['12-25', 'Christmas Day', 'Faith', 'Kosovo · Albania · Christian communities', 'A welcoming festive-table story and accurate opening hours.', albania],
  ['12-31', 'New Year’s Eve', 'Seasonal', 'International', 'Build a full creative direction for the final dinner and countdown of the year.', 'https://www.timeanddate.com/holidays/common/new-year-eve'],
];

function make(date: string, title: string, category: OccasionCategory, region: string, idea: string, source: string, status: Occasion['status'] = 'Confirmed dates', endDate?: string): Occasion {
  return { id: `${date}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, date, title, category, region, idea, source, status, endDate };
}
const dated: Occasion[] = [
  make('2026-09-19', 'Oktoberfest — Munich', 'Drinks', 'Germany · International inspiration', 'Consider a beer-and-food pairing; this is a Munich event, not a confirmed Ysabel event.', 'https://www.oktoberfest.de/en/information/service-for-visitors/faqs-for-wiesn-visitors', 'Confirmed dates', '2026-10-04'),
  make('2026-09-21', 'Negroni Week', 'Drinks', 'International', 'An Italian aperitivo story. Official participation requires registration with the organiser.', 'https://www.negroniweek.com/faqs/', 'Confirmed dates', '2026-09-27'),
  make('2026-09-25', 'Mid-Autumn Festival', 'Faith', 'East Asian communities', 'A respectful sharing-menu concept inspired by reunion and the moon.', 'https://en.wikipedia.org/wiki/Mid-Autumn_Festival'),
  make('2027-02-05', 'Lunar New Year’s Eve', 'Seasonal', 'East Asian communities', 'A reunion-table story for Ysabel Asian, developed with the kitchen.', 'https://chineselunarcalendar.org/festivals'),
  make('2027-02-06', 'Lunar New Year — Year of the Goat', 'Seasonal', 'East Asian communities', 'Plan an Asian dining direction with culturally informed details and warm greetings.', 'https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2027e.pdf'),
  make('2027-02-08', 'Ramadan begins', 'Faith', 'Kosovo · Albania · Muslim communities', 'Consider iftar hospitality and alcohol-free content. The fast begins at dawn; confirm local timings.', kosovo, 'Tentative'),
  make('2027-02-20', 'Lantern Festival', 'Seasonal', 'Chinese communities', 'A refined lantern-lit closing moment for the Lunar New Year period.', 'https://chineselunarcalendar.org/festivals'),
  make('2027-03-10', 'Eid al-Fitr / Fitër Bajrami', 'Faith', 'Kosovo · Albania · Muslim communities', 'Warm family greetings and a generous table. Confirm the local religious announcement.', kosovo, 'Tentative'),
  make('2027-03-28', 'Catholic / Western Easter', 'Faith', 'Christian communities', 'A spring family lunch and a light, seasonal dessert direction.', 'https://www.timeanddate.com/holidays/albania/2027'),
  make('2027-03-29', 'Catholic Easter Monday', 'Faith', 'Kosovo · Christian communities', 'A relaxed lunch for family and friends over the holiday weekend.', kosovo),
  make('2027-05-02', 'Orthodox Easter', 'Faith', 'Orthodox communities', 'Offer warm greetings and consider a family dining invitation.', 'https://www.timeanddate.com/holidays/albania/2027'),
  make('2027-05-03', 'Orthodox Easter Monday', 'Faith', 'Kosovo · Orthodox communities', 'A gathering-led message for guests celebrating Easter.', kosovo),
  make('2027-05-17', 'Eid al-Adha / Kurban Bajrami', 'Faith', 'Kosovo · Albania · Muslim communities', 'A respectful message about generosity and sharing. Confirm the local date before publishing.', kosovo, 'Tentative'),
  make('2027-06-09', 'Dragon Boat Festival', 'Seasonal', 'Chinese communities', 'Explore the festival’s food traditions with the Asian chef before planning a special.', 'https://chineselunarcalendar.org/festivals'),
  make('2027-09-15', 'Mid-Autumn Festival', 'Faith', 'East Asian communities', 'A sharing-table direction with warm moonlit tones.', 'https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2027e.pdf'),
  make('2027-09-18', 'Oktoberfest — Munich', 'Drinks', 'Germany · International inspiration', 'Beer pairings and a harvest-inspired menu, without implying an official partnership.', 'https://www.oktoberfest.de/en/information/service-for-visitors/faqs-for-wiesn-visitors', 'Confirmed dates', '2027-10-03'),
];
export function nthWeekday(year: number, month: number, weekday: number, occurrence: number) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const day = 1 + ((weekday - first + 7) % 7) + (occurrence - 1) * 7;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
for (const year of [2026, 2027]) {
  dated.push(
    make(nthWeekday(year, 5, 6, 3), 'World Whisky Day', 'Drinks', 'International', 'A small whisky tasting and bartender-led flavour notes.', 'https://www.worldwhiskyday.com/when-world-whisky-day/', 'Annual observance'),
    make(nthWeekday(year, 6, 6, 2), 'World Gin Day', 'Drinks', 'International', 'A botanical-led Garden serve and a gin story.', 'https://worldginday.com/about/', 'Annual observance'),
    make(nthWeekday(year, 6, 6, 3), 'World Martini Day', 'Drinks', 'International', 'A precise martini ritual, ice-cold glass and elegant bar photography.', 'https://worldginweek.com/', 'Annual observance'),
    make(nthWeekday(year, 6, 0, 3), 'Father’s Day — third-Sunday observance', 'Community', 'Albania · International inspiration', 'An invitation to share a meal with a father figure; customs vary by country.', 'https://www.timeanddate.com/holidays/albania/2027', 'Annual observance'),
    make(nthWeekday(year, 8, 5, 1), 'International Beer Day', 'Drinks', 'International', 'Spotlight local brewing and a food pairing for adult guests.', 'https://www.internationalbeerday.com/ibdnew/wp-content/uploads/2013/07/International-Beer-Day-For-Bars-2013.pdf', 'Annual observance'),
  );
}
export const occasions: Occasion[] = [
  ...[2026, 2027, 2028].flatMap(year => annual.map(([day, title, category, region, idea, source, informal]) => make(`${year}-${day}`, title, category, region, idea, source, informal ? 'Informal occasion' : 'Annual observance'))),
  ...dated,
].filter(event => event.date >= OCCASION_START && event.date <= OCCASION_END).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

export const occasionsToConfirm = [
  { title: 'Sunny Hill Festival 2027', region: 'Prishtina', idea: 'Visitor dining, diaspora reunions and music-led content. Dates not confirmed in the sources checked.', source: 'https://www.sunnyhillfestival.com/' },
  { title: 'DokuFest 2027', region: 'Prizren', idea: 'Kosovo arts and visitor hospitality; confirm the festival schedule before building content around it.', source: 'https://dokufest.com/' },
  { title: 'Negroni Week 2027', region: 'International', idea: 'Italian aperitivo and potential registered participation. Await the organiser’s dates.', source: 'https://www.negroniweek.com/faqs/' },
  { title: 'Ysabel anniversary, guest DJs & seasonal openings', region: 'Ysabel Society', idea: 'Add the dates to your planning notes once management confirms the programme.', source: 'https://www.instagram.com/ysabelsociety/' },
];

export function eventsOnDate(date: string, events = occasions) {
  return events.filter(event => event.date <= date && (event.endDate || event.date) >= date);
}
