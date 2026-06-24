import pkg from "flightradarapi";
import { haversineKm } from "../geo.js";

const { FlightRadar24API } = pkg;
const api = new FlightRadar24API();

/** Map an SDK Flight into our normalized shape. */
function normalize(flight, homeLat, homeLon) {
  const lat = flight.latitude;
  const lon = flight.longitude;
  return {
    id: flight.id,
    callsign: clean(flight.callsign) || clean(flight.number),
    flightNumber: clean(flight.number),
    airline: clean(flight.airlineName) || clean(flight.airlineIcao) || clean(flight.airlineIata),
    originIata: clean(flight.originAirportIata),
    destIata: clean(flight.destinationAirportIata),
    originName: clean(flight.originAirportName),
    destName: clean(flight.destinationAirportName),
    originCity: clean(flight.originCity), // populated during enrich()
    destCity: clean(flight.destCity),
    model: clean(flight.aircraftModel) || clean(flight.aircraftCode),
    registration: clean(flight.registration),
    altitudeFt: numeric(flight.altitude),
    groundSpeedKt: numeric(flight.groundSpeed),
    headingDeg: numeric(flight.heading),
    lat,
    lon,
    distanceKm: round1(haversineKm(homeLat, homeLon, lat, lon)),
    source: "fr24",
    _raw: flight, // kept for optional detail enrichment
  };
}

function clean(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" || s === "N/A" ? null : s;
}
function numeric(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Fetch flights within radiusKm of home. Throws on failure so the poller can
 * fall back to OpenSky.
 */
export async function fetchFlights(homeLat, homeLon, radiusKm) {
  const bounds = api.getBoundsByPoint(homeLat, homeLon, radiusKm * 1000);
  const flights = await api.getFlights(null, bounds);
  return flights
    .filter((f) => Number.isFinite(f.latitude) && Number.isFinite(f.longitude) && !f.onGround)
    .map((f) => normalize(f, homeLat, homeLon));
}

/**
 * Enrich a single normalized flight in-place with model + airport names via the
 * heavier per-flight details endpoint. Best-effort: swallows errors.
 */
export async function enrich(flight, homeLat, homeLon) {
  if (flight.source !== "fr24" || !flight._raw) return flight;
  try {
    const details = await api.getFlightDetails(flight._raw);
    flight._raw.setFlightDetails(details);
    const enriched = normalize(flight._raw, homeLat, homeLon);
    // City lives only in the raw details payload, not on the SDK Flight object.
    enriched.originCity = clean(details?.airport?.origin?.position?.region?.city);
    enriched.destCity = clean(details?.airport?.destination?.position?.region?.city);
    return { ...flight, ...enriched, distanceKm: flight.distanceKm };
  } catch {
    return flight; // keep base data if detail lookup fails
  }
}
