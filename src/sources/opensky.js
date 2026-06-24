import { boundingBox, haversineKm } from "../geo.js";

const BASE = "https://opensky-network.org/api/states/all";

// /states/all state-vector array indices (see OpenSky REST docs).
const I = {
  ICAO24: 0,
  CALLSIGN: 1,
  LON: 5,
  LAT: 6,
  BARO_ALT: 7, // metres
  ON_GROUND: 8,
  VELOCITY: 9, // m/s
  HEADING: 10,
  GEO_ALT: 13, // metres
};

const M_TO_FT = 3.28084;
const MS_TO_KT = 1.94384;

/**
 * Fetch flights within radiusKm of home from OpenSky (anonymous, free tier).
 * Returns the same normalized shape as the FR24 source, but route + model are
 * null because the live feed does not carry them.
 */
export async function fetchFlights(homeLat, homeLon, radiusKm) {
  const { lamin, lamax, lomin, lomax } = boundingBox(homeLat, homeLon, radiusKm);
  const url = `${BASE}?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
  const res = await fetch(url, { headers: { "User-Agent": "flight-notifier" } });
  if (!res.ok) throw new Error(`OpenSky HTTP ${res.status}`);
  const body = await res.json();
  const states = Array.isArray(body?.states) ? body.states : [];

  return states
    .filter((s) => s[I.LAT] != null && s[I.LON] != null && !s[I.ON_GROUND])
    .map((s) => {
      const lat = s[I.LAT];
      const lon = s[I.LON];
      const altM = s[I.GEO_ALT] ?? s[I.BARO_ALT];
      return {
        id: String(s[I.ICAO24]),
        callsign: (s[I.CALLSIGN] || "").trim() || null,
        flightNumber: null,
        airline: null,
        originIata: null,
        destIata: null,
        originName: null,
        destName: null,
        originCity: null,
        destCity: null,
        model: null,
        registration: null,
        altitudeFt: altM != null ? Math.round(altM * M_TO_FT) : null,
        groundSpeedKt: s[I.VELOCITY] != null ? Math.round(s[I.VELOCITY] * MS_TO_KT) : null,
        headingDeg: s[I.HEADING] ?? null,
        lat,
        lon,
        distanceKm: Math.round(haversineKm(homeLat, homeLon, lat, lon) * 10) / 10,
        source: "opensky",
      };
    });
}
