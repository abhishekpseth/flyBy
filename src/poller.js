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

/** One poll cycle: fetch → filter to exact radius → enrich → notify → cache. */
export async function tick() {
  const { HOME_LAT, HOME_LON, RADIUS_KM, ENRICH_DETAILS } = config;
  let flights;
  let source;

  try {
    flights = await fr24.fetchFlights(HOME_LAT, HOME_LON, RADIUS_KM);
    source = "fr24";
  } catch (err) {
    console.warn(`[poll] FR24 failed (${err.message}); falling back to OpenSky.`);
    try {
      flights = await opensky.fetchFlights(HOME_LAT, HOME_LON, RADIUS_KM);
      source = "opensky";
    } catch (err2) {
      console.warn(`[poll] OpenSky also failed (${err2.message}); keeping last snapshot.`);
      return;
    }
  }

  // The bounding box is square; trim to the true circular radius.
  flights = flights.filter((f) => f.distanceKm <= RADIUS_KM).sort((a, b) => a.distanceKm - b.distanceKm);

  const newEntrants = diffNewEntrants(flights);

  // Enrich (FR24 only) the nearest plane + any new entrants, to limit requests.
  if (source === "fr24" && ENRICH_DETAILS) {
    const toEnrich = new Set([nearest(flights), ...newEntrants].filter(Boolean));
    await Promise.all(
      [...toEnrich].map(async (f) => {
        const e = await fr24.enrich(f, HOME_LAT, HOME_LON);
        Object.assign(f, e);
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
