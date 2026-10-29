// One place for how dates look in the app, so the date picker, trip.js and
// the Trip dates screen all match.
//
//   formatDate('2026-11-21')                      ->  Nov 21, 2026 (Sat)
//   formatDate('2026-11-21', { weekday: false })  ->  Nov 21, 2026
//   formatDate('2026-11-21', { year: false })     ->  Nov 21 (Sat)
//   formatShort('2026-11-21')                     ->  Nov 21
//   formatRange('2026-11-21', '2026-12-02')       ->  Nov 21 – Dec 2, 2026
//
// To change the look everywhere later, only edit this file.

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDate(iso, { year = true, weekday = true } = {}) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  let out = `${MONTHS_SHORT[m - 1]} ${d}`;
  if (year) out += `, ${y}`;
  if (weekday) out += ` (${WEEKDAYS[wd]})`;
  return out;
}

export function formatShort(iso) {
  return formatDate(iso, { year: false, weekday: false });
}

export function formatRange(start, end) {
  const sy = start.split('-')[0];
  const ey = end.split('-')[0];
  if (sy === ey) return `${formatShort(start)} – ${formatShort(end)}, ${ey}`;
  return `${formatDate(start, { weekday: false })} – ${formatDate(end, { weekday: false })}`;
}