import { store, isNetworkError } from './offline';
import { auth } from './firebase';

export const FIRESTORE_BASE =
  'https://firestore.googleapis.com/v1/projects/travelapp-10305/databases/(default)/documents';

// ---------------------------------------------------------------------------------------------
// Login token
//
// Firebase login tokens only last about an hour. The token handed in by the screens can be out of
// date (laptop asleep, tab in the background, a refresh that failed once), and the database then
// answers "401 UNAUTHENTICATED". So every request asks Firebase for the current token (it refreshes
// it by itself when it is close to expiring), and if the database still says 401 it forces a brand
// new token and tries once more.
// ---------------------------------------------------------------------------------------------
async function tokenFor(passed, force = false) {
  try {
    const user = auth && auth.currentUser;
    if (user) return await user.getIdToken(force);
  } catch (e) {
    // no signal, or no signed-in user: fall back to the token we were given
  }
  return passed;
}

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
  'spots?pageSize=300', // SpotsScreen, linkSync
  'transport?pageSize=300', // BookingsScreen, ItineraryScreen
  'stays?pageSize=300', // BookingsScreen, ItineraryScreen
  'plans?pageSize=300', // BookingsScreen, ItineraryScreen, linkSync
  'profiles?pageSize=300', // Bookings, Itinerary, Expenses, To-do
  'profiles?pageSize=100', // HomeScreen
  'expenses?pageSize=300', // ExpensesScreen
  'todos?pageSize=300', // TodoScreen, Home
  'settings/trip', // trip name, destination and dates
];

const SPOTS_KEY = 'fs:' + FIRESTORE_BASE + '/spots?pageSize=300';
let lastPrefetch = 0;
let prefetching = false;

// The real request + saved copy. firestoreFetch (below) and the background loader both use it.
async function request(url, authToken, options = {}) {
  if (!authToken) {
    throw new Error('Please sign in first.');
  }

  const isRead = !options.method || String(options.method).toUpperCase() === 'GET';
  const cacheKey = 'fs:' + url;

  const send = token =>
    fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

  // no signal: a read falls back to the last saved copy
  const offlineCopy = error => {
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
  };

  let response;
  try {
    response = await send(await tokenFor(authToken));
  } catch (error) {
    return offlineCopy(error);
  }

  // 401 = the token was rejected. Get a brand new one and try once more.
  if (response.status === 401) {
    try {
      const fresh = await tokenFor(authToken, true);
      response = await send(fresh);
    } catch (error) {
      return offlineCopy(error);
    }
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