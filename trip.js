export const TRIP_START = '2026-11-21';
export const TRIP_END = '2026-12-02';
export const TRIP_LABEL = '21 Nov – 2 Dec';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_MS = 24 * 60 * 60 * 1000;

const toUtc = iso => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

const toIso = t => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

function buildRange(startT, endT) {
  const days = [];
  for (let t = startT; t <= endT; t += DAY_MS) {
    const d = new Date(t);
    const iso = toIso(t);
    days.push({
      iso,
      dayNumber: days.length + 1,
      short: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`,
      weekday: WEEKDAYS[d.getUTCDay()],
      inTrip: iso >= TRIP_START && iso <= TRIP_END,
    });
  }
  return days;
}

// The trip days (used by the Plan tab)
export const DAYS = buildRange(toUtc(TRIP_START), toUtc(TRIP_END));

// A wider range for picking booking dates: 21 days before and after the trip
export const PICK_DAYS = buildRange(
  toUtc(TRIP_START) - 21 * DAY_MS,
  toUtc(TRIP_END) + 21 * DAY_MS
);