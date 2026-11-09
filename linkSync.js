import { firestoreFetch, FIRESTORE_BASE } from './firestore';

// Keeps a Spot and the Itinerary items made from it in step.
//   - Edit a spot  -> every itinerary item made from it is updated.
//   - Edit an itinerary item -> its spot (and the same spot on other days) is updated.
// Items are linked by the spot's id saved on the plan ("spotId"). Items added before this existed
// have no id, so they are matched by the spot's name, and get linked the first time they are edited.
// Activities and restaurants from the Bookings tab ARE the itinerary item (same record),
// so they never need this.

const API = 'https://firestore.googleapis.com/v1/';
const str = (doc, key) => doc.fields?.[key]?.stringValue || '';
const sv = v => ({ stringValue: v || '' });
const maskOf = fields =>
  Object.keys(fields)
    .map(key => `updateMask.fieldPaths=${key}`)
    .join('&');

async function patch(docPath, fields, authToken) {
  await firestoreFetch(`${API}${docPath}?${maskOf(fields)}`, authToken, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
}

async function list(collection, authToken) {
  const res = await firestoreFetch(`${FIRESTORE_BASE}/${collection}?pageSize=300`, authToken);
  const data = await res.json();
  return data.documents || [];
}

// shared = { name, address, note, category }
const spotFields = s => ({
  name: sv(s.name),
  address: sv(s.address),
  note: sv(s.note),
  category: sv(s.category || 'spot'),
});
const planFields = s => ({
  spotName: sv(s.name),
  address: sv(s.address),
  note: sv(s.note),
  category: sv(s.category || 'spot'),
});

// A spot was edited: update the itinerary items made from it.
// spotId = the spot's document path, oldName = its name BEFORE the edit.
export async function pushSpotToPlans(spotId, oldName, shared, authToken) {
  const plans = await list('plans', authToken);
  const hits = plans.filter(
    doc =>
      str(doc, 'source') !== 'booking' &&
      (str(doc, 'spotId') === spotId || (!str(doc, 'spotId') && str(doc, 'spotName') === oldName))
  );
  for (const doc of hits) {
    await patch(doc.name, { ...planFields(shared), spotId: sv(spotId) }, authToken);
  }
  return hits.length;
}

// An itinerary item was edited: update its spot and the same spot's other itinerary items.
// plan = the item BEFORE the edit (so its old name can be used to find a spot made earlier),
// allPlans = every plan currently on screen.
export async function syncPlanToSpot(plan, shared, allPlans, authToken) {
  let spotId = plan.spotId;

  if (!spotId) {
    const spots = await list('spots', authToken);
    const match = spots.find(doc => str(doc, 'name') === plan.spotName);
    if (match) spotId = match.name;
  }
  if (!spotId) return false; // no matching spot (it may have been deleted)

  await patch(spotId, spotFields(shared), authToken);

  // link this item if it was made before links existed
  if (!plan.spotId) await patch(plan.id, { spotId: sv(spotId) }, authToken);

  const others = allPlans.filter(
    p =>
      p.id !== plan.id &&
      p.source !== 'booking' &&
      (p.spotId === spotId || (!p.spotId && p.spotName === plan.spotName))
  );
  for (const p of others) {
    await patch(p.id, { ...planFields(shared), spotId: sv(spotId) }, authToken);
  }
  return true;
}