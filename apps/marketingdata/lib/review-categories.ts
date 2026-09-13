export const REVIEW_CATEGORIES = [
  {topic:'Food',label:'Food, dishes & plates',detail:'Taste, cooking, freshness, dishes, portions and presentation'},
  {topic:'Drinks',label:'Drinks & beverages',detail:'Cocktails, wine, coffee, water and drink quality'},
  {topic:'Menu',label:'Menu & choice',detail:'Variety, selection, unavailable items and menu clarity'},
  {topic:'Service',label:'Service & staff',detail:'Waiters, order accuracy, attention and professionalism'},
  {topic:'Hospitality',label:'Hospitality & welcome',detail:'Reception, greeting, courtesy and guest treatment'},
  {topic:'Cleanliness',label:'Cleanliness & hygiene',detail:'Clean or dirty plates, glasses, cutlery, tables and toilets'},
  {topic:'Reservations',label:'Reservations & bookings',detail:'Booking, confirmation, cancellation and table availability'},
  {topic:'Atmosphere',label:'Atmosphere & comfort',detail:'Music, noise, seating, decor, ventilation and comfort'},
  {topic:'Waiting time',label:'Waiting time',detail:'Delays with seating, orders, food, drinks and payment'},
  {topic:'Price & value',label:'Price & value',detail:'Prices, bills, charges, portion value and parking costs'},
  {topic:'Dietary needs',label:'Dietary needs & allergens',detail:'Allergies, ingredients, vegetarian, vegan and gluten-free needs'},
  {topic:'Accessibility',label:'Accessibility',detail:'Entry, mobility access, lifts and guest accessibility'},
  {topic:'Opening hours',label:'Opening hours',detail:'Kitchen opening times, early closures and service availability'},
  {topic:'Other',label:'Other guest concerns',detail:'Supported feedback outside the categories above'},
] as const;
export function reviewCategoryLabel(topic:string){return REVIEW_CATEGORIES.find(c=>c.topic===topic)?.label||topic;}
