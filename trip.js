import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_MS = 24 * 60 * 60 * 1000;

export const MAX_DAYS = 60;
export const DEFAULT_START = '2026-11-21';
export const DEFAULT_END = '2026-12-02';

// Used until the trip is saved for the first time. Change them from Home > Edit trip.
const DEFAULTS = {
  start: DEFAULT_START,
  end: DEFAULT_END,
  name: 'Our NZ adventure',
  destination: 'Queenstown, Otago, New Zealand',
  latitude: -45.0312,
  longitude: 168.6626,
};

const toUtc = iso => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

const toIso = t => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

export function dayCount(start, end) {
  return Math.round((toUtc(end) - toUtc(start)) / DAY_MS) + 1;
}

export function buildDays(start, end) {
  const days = [];
  for (let t = toUtc(start); t <= toUtc(end) && days.length < MAX_DAYS; t += DAY_MS) {
    const d = new Date(t);
    days.push({
      iso: toIso(t),
      dayNumber: days.length + 1,
      short: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`,
      weekday: WEEKDAYS[d.getUTCDay()],
    });
  }
  return days;
}

export function formatRange(start, end) {
  const [, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  return `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]} ${ey}`;
}

const TripContext = createContext({
  ...DEFAULTS,
  label: formatRange(DEFAULTS.start, DEFAULTS.end),
  days: buildDays(DEFAULTS.start, DEFAULTS.end),
  saveTrip: async () => false,
});

const num = field =>
  field ? Number(field.doubleValue ?? field.integerValue) : null;

export function TripProvider({ authToken, children }) {
  const [trip, setTrip] = useState(DEFAULTS);

  const load = useCallback(async () => {
    try {
      const res = await firestoreFetch(`${FIRESTORE_BASE}/settings/trip`, authToken);
      const doc = await res.json();
      const f = doc.fields || {};
      const s = f.start?.stringValue;
      const e = f.end?.stringValue;
      if (s && e) {
        const next = {
          start: s,
          end: e,
          name: f.name?.stringValue || DEFAULTS.name,
          destination: f.destination?.stringValue || DEFAULTS.destination,
          latitude: num(f.latitude) ?? DEFAULTS.latitude,
          longitude: num(f.longitude) ?? DEFAULTS.longitude,
        };
        setTrip(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      }
    } catch (error) {
      // 404 just means the trip was never saved, so the defaults are used
      if (!String(error.message).includes('(404)')) {
        console.error('Error loading trip:', error);
      }
    }
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [authToken, load]);

  // saveTrip(start, end) still works as before.
  // saveTrip(start, end, { name, destination, latitude, longitude }) saves the extras too.
  const saveTrip = useCallback(
    async (start, end, extra = {}) => {
      try {
        const fields = {
          start: { stringValue: start },
          end: { stringValue: end },
        };
        Object.entries(extra).forEach(([key, value]) => {
          fields[key] =
            typeof value === 'number'
              ? { doubleValue: value }
              : { stringValue: String(value) };
        });
        // The mask means only these fields change, nothing else is wiped
        const mask = Object.keys(fields)
          .map(key => `updateMask.fieldPaths=${key}`)
          .join('&');

        await firestoreFetch(`${FIRESTORE_BASE}/settings/trip?${mask}`, authToken, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields }),
        });
        setTrip(prev => ({ ...prev, start, end, ...extra }));
        return true;
      } catch (error) {
        console.error('Error saving trip:', error);
        return false;
      }
    },
    [authToken]
  );

  const value = useMemo(
    () => ({
      ...trip,
      label: formatRange(trip.start, trip.end),
      days: buildDays(trip.start, trip.end),
      saveTrip,
    }),
    [trip, saveTrip]
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip() {
  return useContext(TripContext);
}