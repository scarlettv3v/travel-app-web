// Asks the free OSRM service for the driving route through the stops, in order
export async function getRoute(stops) {
  try {
    const coords = stops.map(s => `${s.lng},${s.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes || !data.routes.length) return null;

    const r = data.routes[0];
    return {
      totalSeconds: r.duration,
      totalMeters: r.distance,
      legs: r.legs.map(l => ({ seconds: l.duration, meters: l.distance })),
      coords: r.geometry.coordinates.map(([lng, lat]) => ({
        latitude: lat,
        longitude: lng,
      })),
    };
  } catch (error) {
    console.error('Routing failed:', error);
    return null;
  }
}

export function formatDuration(seconds) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatDistance(meters) {
  return `${Math.round(meters / 1000)} km`;
}