export const FIRESTORE_BASE =
  'https://firestore.googleapis.com/v1/projects/travelapp-10305/databases/(default)/documents';

export async function firestoreFetch(url, authToken, options = {}) {
  if (!authToken) {
    throw new Error('Please sign in first.');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Database request failed (${response.status}): ${message}`
    );
  }

  return response;
}