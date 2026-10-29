import { store, isNetworkError } from './offline';

export const FIRESTORE_BASE =
  'https://firestore.googleapis.com/v1/projects/travelapp-10305/databases/(default)/documents';

// ---------------------------------------------------------------------------------------------
// Offline reading
//
// Every screen reads its data through firestoreFetch, so this is where offline reading is handled:
// each successful read is saved on the device, and when there is no signal the last saved copy is
// returned instead. Writes (add / edit / delete) always need a connection, except new expenses,
// which ExpensesScreen queues itself.
//
// Saved copies are matched by the exact address (URL) a screen asks for. If you ever change the
// address a screen uses, update the matching line in PREFETCH below.
// ---------------------------------------------------------------------------------------------

// What every tab loads. A few seconds after the first successful load (and again every 5 minutes),
// these are all fetched in the background, so every tab has something to show offline even if
// you never opened it.
const PREFETCH = [
  'spots', // SpotsScreen
  'transport?pageSize=300', // BookingsScreen, ItineraryScreen
  'stays?pageSize=300', // BookingsScreen, ItineraryScreen
  'plans?pageSize=300', // BookingsScreen, ItineraryScreen
  'profiles?pageSize=300', // Bookings, Itinerary, Expenses
  'profiles?pageSize=100', // HomeScreen
  'expenses?pageSize=300', // ExpensesScreen
  'settings/trip', // trip name, destination and dates
];

const SPOTS_KEY = 'fs:' + FIRESTORE_BASE + '/spots';
let lastPrefetch = 0;
let prefetching = false;

// The real request + saved copy. firestoreFetch (below) and the background loader both use it.
async function request(url, authToken, options = {}) {
  if (!authToken) {
    throw new Error('Please sign in first.');
  }

  const isRead = !options.method || String(options.method).toUpperCase() === 'GET';
  const cacheKey = 'fs:' + url;

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${authToken}`,
      },
    });
  } catch (error) {
    if (isRead && isNetworkError(error)) {
      const saved = store.get(cacheKey, null);
      if (typeof saved === 'string') {
        return new Response(saved, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    throw error;
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Database request failed (${response.status}): ${message}`
    );
  }

  if (isRead) {
    try {
      const text = await response.clone().text();
      if (text.length < 500000 && store.get(cacheKey, null) !== text) {
        store.set(cacheKey, text);
      }
    } catch (e) {
      // saving a copy is a bonus, never a reason to fail
    }
  }

  return response;
}

// Loads every tab's data in the background so it is saved for offline use
function maybePrefetch(authToken) {
  if (prefetching || !authToken || authToken === 'offline') return;
  if (typeof document !== 'undefined' && document.hidden) return;

  const since = Date.now() - lastPrefetch;
  if (since < 30 * 1000) return; // never more than once every 30 seconds
  // Within 5 minutes, only run again if the saved copies were cleared (for example after log out)
  if (since < 5 * 60 * 1000 && store.get(SPOTS_KEY, null) !== null) return;

  lastPrefetch = Date.now();
  prefetching = true;

  setTimeout(async () => {
    try {
      await Promise.allSettled(
        PREFETCH.map(path => request(`${FIRESTORE_BASE}/${path}`, authToken))
      );
    } finally {
      prefetching = false;
    }
  }, 1500);
}

export async function firestoreFetch(url, authToken, options = {}) {
  const response = await request(url, authToken, options);

  const isRead = !options.method || String(options.method).toUpperCase() === 'GET';
  if (isRead) maybePrefetch(authToken);

  return response;
}