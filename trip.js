export const TRIP_START = '2026-11-21';
export const TRIP_END = '2026-12-02';
export const TRIP_LABEL = '21 Nov – 2 Dec';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function buildDays() {
  const [sy, sm, sd] = TRIP_START.split('-').map(Number);
  const [ey, em, ed] = TRIP_END.split('-').map(Number);
  const end = Date.UTC(ey, em - 1, ed);
  const days = [];
  let t = Date.UTC(sy, sm - 1, sd);
  while (t <= end) {
    const d = new Date(t);
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    days.push({
      iso,
      dayNumber: days.length + 1,
      short: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`,
      weekday: WEEKDAYS[d.getUTCDay()],
    });
    t += 24 * 60 * 60 * 1000;
  }
  return days;
}

export const DAYS = buildDays();