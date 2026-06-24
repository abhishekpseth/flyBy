const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance between two lat/lon points, in kilometres. */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * Axis-aligned bounding box around a point, padded by radiusKm.
 * Returns { lamin, lamax, lomin, lomax } as used by OpenSky's /states/all.
 */
export function boundingBox(lat, lon, radiusKm) {
  const dLat = (radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI);
  const dLon = dLat / Math.max(Math.cos(toRad(lat)), 1e-6);
  return {
    lamin: lat - dLat,
    lamax: lat + dLat,
    lomin: lon - dLon,
    lomax: lon + dLon,
  };
}
