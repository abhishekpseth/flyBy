import { boundingBox, haversineKm } from "../geo.js";

const BASE = "https://opensky-network.org/api/states/all";
const TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

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

// Cached OAuth2 token (client-credentials flow). Tokens live 30 min; we refresh
// a minute early. Without credentials we fall back to anonymous access.
let tokenCache = { token: null, expiresAt: 0 };

async function getAccessToken() {
  const id = process.env.OPENSKY_CLIENT_ID;
  const secret = process.env.OPENSKY_CLIENT_SECRET;
  if (!id || !secret) return null; // anonymous mode

  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: secret,
    }),
  });
  if (!res.ok) throw new Error(`OpenSky auth HTTP ${res.status}`);
  const j = await res.json();
  tokenCache = {
    token: j.access_token,
    expiresAt: Date.now() + Math.max(0, (j.expires_in ?? 1800) - 60) * 1000,
  };
  return tokenCache.token;
}

/** True when OAuth2 credentials are configured (4000 credits/day vs 400 anon). */
export function isAuthenticated() {
  return Boolean(process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET);
}

/**
 * Fetch airborne flights within radiusKm of home from OpenSky.
 * Uses OAuth2 if OPENSKY_CLIENT_ID/SECRET are set, else anonymous.
 * Returns the same normalized shape as the FR24 source; route + model are null
 * because the live state feed does not carry them (FR24 enriches those).
 */
export async function fetchFlights(homeLat, homeLon, radiusKm) {
  const { lamin, lamax, lomin, lomax } = boundingBox(homeLat, homeLon, radiusKm);
  const url = `${BASE}?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

  const headers = { "User-Agent": "flight-notifier" };
  const token = await getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`OpenSky HTTP ${res.status}`);
  const body = await res.json();
  const states = Array.isArray(body?.states) ? body.states : [];

  return states
    .filter((s) => s[I.LAT] != null && s[I.LON] != null && !s[I.ON_GROUND])
    .map((s) => {
      const lat = s[I.LAT];
      const lon = s[I.LON];
      const altM = s[I.GEO_ALT] ?? s[I.BARO_ALT];
      const icao24 = String(s[I.ICAO24]).toLowerCase();
      return {
        id: icao24,
        icao24,
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
