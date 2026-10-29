// [location, currency]. Used by Profile > Trip settings > "Your default currency".
// Add more lines here any time.
export const LOCATIONS = [
  ['Hong Kong', 'HKD'],
  ['Macau', 'MOP'],
  ['Mainland China', 'CNY'],
  ['Taiwan', 'TWD'],
  ['Japan', 'JPY'],
  ['South Korea', 'KRW'],
  ['Singapore', 'SGD'],
  ['Malaysia', 'MYR'],
  ['Thailand', 'THB'],
  ['Vietnam', 'VND'],
  ['Philippines', 'PHP'],
  ['Indonesia', 'IDR'],
  ['India', 'INR'],
  ['New Zealand', 'NZD'],
  ['Australia', 'AUD'],
  ['United States', 'USD'],
  ['Canada', 'CAD'],
  ['United Kingdom', 'GBP'],
  ['Europe (euro)', 'EUR'],
  ['Switzerland', 'CHF'],
  ['UAE', 'AED'],
];

// Country name -> currency. The trip currency is worked out from the trip's Destination text
// (e.g. "Hong Kong, Hong Kong, Hong Kong" -> HKD), so there is nothing to pick.
// If a destination is not recognised, add its country here.
const BY_COUNTRY = {
  'hong kong': 'HKD', macau: 'MOP', macao: 'MOP', china: 'CNY', taiwan: 'TWD', japan: 'JPY',
  'south korea': 'KRW', korea: 'KRW', singapore: 'SGD', malaysia: 'MYR', thailand: 'THB',
  vietnam: 'VND', philippines: 'PHP', indonesia: 'IDR', india: 'INR', 'new zealand': 'NZD',
  australia: 'AUD', 'united states': 'USD', 'united states of america': 'USD', usa: 'USD',
  canada: 'CAD', 'united kingdom': 'GBP', england: 'GBP', scotland: 'GBP', wales: 'GBP',
  'northern ireland': 'GBP', switzerland: 'CHF', liechtenstein: 'CHF',
  'united arab emirates': 'AED', uae: 'AED', norway: 'NOK', sweden: 'SEK', denmark: 'DKK',
  iceland: 'ISK', czechia: 'CZK', 'czech republic': 'CZK', poland: 'PLN', hungary: 'HUF',
  romania: 'RON', turkey: 'TRY', türkiye: 'TRY', turkiye: 'TRY', mexico: 'MXN', brazil: 'BRL',
  argentina: 'ARS', chile: 'CLP', 'south africa': 'ZAR', egypt: 'EGP', morocco: 'MAD',
  israel: 'ILS', 'saudi arabia': 'SAR', qatar: 'QAR', 'sri lanka': 'LKR', nepal: 'NPR',
  cambodia: 'KHR', laos: 'LAK', maldives: 'MVR', fiji: 'FJD',
  ...Object.fromEntries(
    [
      'austria', 'belgium', 'cyprus', 'germany', 'estonia', 'spain', 'finland', 'france',
      'greece', 'croatia', 'ireland', 'italy', 'lithuania', 'luxembourg', 'latvia', 'malta',
      'netherlands', 'portugal', 'slovenia', 'slovakia', 'andorra', 'monaco', 'san marino',
      'vatican city', 'montenegro', 'kosovo',
    ].map(name => [name, 'EUR'])
  ),
};

// "Hong Kong, Hong Kong, Hong Kong" -> 'HKD'. Returns null if the country is not recognised.
export function currencyForDestination(text) {
  const parts = String(text || '')
    .split(',')
    .map(p => p.trim().toLowerCase())
    .filter(Boolean)
    .reverse(); // the country is normally last
  for (const part of parts) {
    if (BY_COUNTRY[part]) return BY_COUNTRY[part];
  }
  return null;
}