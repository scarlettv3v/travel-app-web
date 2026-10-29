import { store, isNetworkError } from './offline';

export const FIRESTORE_BASE =
  'https://firestore.googleapis.com/v1/projects/travelapp-10305/databases/(default)/documents';

// Every screen reads its data through this function, so this is where offline reading is handled:
// each successful read is saved on the device, and when there is no signal the last saved copy is
// returned instead. Writes (add / edit / delete) always need a connection, except new expenses,
// which ExpensesScreen queues itself.
export async function firestoreFetch(url, authToken, options = {}) {
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