import { config } from "./config.js";
import * as fr24 from "./sources/flightradar.js";
import * as opensky from "./sources/opensky.js";
import { diffNewEntrants } from "./state.js";
import { notifyNewFlight } from "./notify.js";
import { nearest } from "./format.js";

// Latest snapshot, read by the HTTP endpoints.
export const snapshot = {
  flights: [],
  source: null,
  updatedAt: null,
};

// FR24 fields worth grafting onto an OpenSky-detected flight (route + model +
// airline). Position/altitude/distance stay OpenSky's — it's our source of truth.
function graftFr24(target, m) {
  for (const k of [
    "flightNumber", "airline", "originIata", "destIata",
    "originName", "destName", "model", "registration",
  ]) {
    if (m[k] != null) target[k] = m[k];
  }
  target._raw = m._raw; // enables the optional details lookup below
  target.source = "opensky+fr24";
}

/**
 * Add route/model/airline to in-range flights using FR24 — but only when
 * something is actually overhead, so FR24 is hit rarely and never throttles.
 * OpenSky-detected planes are matched to FR24 records by ICAO 24-bit hex (then
 * callsign). Best-effort: on any FR24 failure we keep the OpenSky data as-is.
 */
async function enrichWithFr24(flights, homeLat, homeLon) {
  let fr24Flights;
  try {
    fr24Flights = await fr24.fetchFlights(homeLat, homeLon, config.RADIUS_KM);
  } catch (err) {
    console.warn(`[poll] FR24 enrich skipped (${err.message}); showing OpenSky data.`);
    return false;
  }

  const byIcao = new Map();
  const byCall = new Map();
  for (const m of fr24Flights) {
    if (m.icao24) byIcao.set(m.icao24, m);
    if (m.callsign) byCall.set(m.callsign.toUpperCase(), m);
  }

  let matched = false;
  for (const f of flights) {
    const m =
      (f.icao24 && byIcao.get(f.icao24)) ||
      (f.callsign && byCall.get(f.callsign.toUpperCase()));
    if (m) {
      graftFr24(f, m);
      matched = true;
    }
  }
  return matched;
}

/** One poll cycle: OpenSky gate → (on hit) FR24 enrich → notify → cache. */
export async function tick() {
  const { HOME_LAT, HOME_LON, RADIUS_KM, ENRICH_DETAILS } = config;
  let flights;
  let source;

  // 1. Primary gate: OpenSky (cheap, quota-based). FR24 is the fallback if it fails.
  try {
    flights = await opensky.fetchFlights(HOME_LAT, HOME_LON, RADIUS_KM);
    source = "opensky";
  } catch (err) {
    console.warn(`[poll] OpenSky failed (${err.message}); falling back to FR24.`);
    try {
      flights = await fr24.fetchFlights(HOME_LAT, HOME_LON, RADIUS_KM);
      source = "fr24";
    } catch (err2) {
      console.warn(`[poll] FR24 also failed (${err2.message}); keeping last snapshot.`);
      return;
    }
  }

  // The bounding box is square; trim to the true circular radius.
  flights = flights
    .filter((f) => f.distanceKm <= RADIUS_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  // 2. Only when something is overhead, spend FR24 calls to add route/model.
  if (flights.length && source === "opensky" && ENRICH_DETAILS) {
    if (await enrichWithFr24(flights, HOME_LAT, HOME_LON)) source = "opensky+fr24";
  }

  const newEntrants = diffNewEntrants(flights);

  // 3. Deep-enrich (full airport cities/model) the nearest + new entrants that
  //    have an FR24 record, via the heavier per-flight details endpoint.
  if (ENRICH_DETAILS) {
    const toEnrich = new Set([nearest(flights), ...newEntrants].filter((f) => f && f._raw));
    await Promise.all(
      [...toEnrich].map(async (f) => {
        const e = await fr24.enrich(f, HOME_LAT, HOME_LON);
        Object.assign(f, e, { source: "opensky+fr24" });
      }),
    );
  }

  for (const f of newEntrants) notifyNewFlight(f);

  snapshot.flights = flights.map(({ _raw, ...rest }) => rest); // drop raw SDK object
  snapshot.source = source;
  snapshot.updatedAt = new Date().toISOString();

  const n = nearest(flights);
  console.log(
    `[poll] ${flights.length} in radius via ${source}` +
      (n ? ` · nearest ${n.callsign ?? "?"} @ ${n.distanceKm}km` : "") +
      (newEntrants.length ? ` · ${newEntrants.length} new` : ""),
  );
}

/** Start the polling loop. Returns a stop() function. */
export function startPolling() {
  const everyMs = Math.max(5, config.POLL_SECONDS) * 1000;
  tick().catch((e) => console.error("[poll] tick error:", e));
  const timer = setInterval(() => tick().catch((e) => console.error("[poll] tick error:", e)), everyMs);
  return () => clearInterval(timer);
}
