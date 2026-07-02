const dash = (v) => (v == null || v === "" ? "—" : v);

/** Altitude: feet, or flight-level (FL350) when high — compact and readable. */
function altStr(ft) {
  if (ft == null) return "—";
  if (ft >= 18000) return `FL${Math.round(ft / 100)}`;
  return `${Number(ft).toLocaleString("en-US")} ft`;
}

function distStr(km) {
  return km == null ? "—" : `${km} km`;
}

/**
 * One endpoint of a route as "City (CODE)", e.g. "Mumbai (BOM)".
 * Falls back to the airport name, then the bare code, when the city is missing.
 */
function endpoint(city, name, iata) {
  if (city) return iata ? `${city} (${iata})` : city;
  if (name) return name;
  return iata || "—";
}

const hasOrigin = (f) => Boolean(f.originCity || f.originName || f.originIata);
const hasDest = (f) => Boolean(f.destCity || f.destName || f.destIata);

/**
 * Full route string, e.g. "Mumbai (BOM) → Delhi (DEL)", or null when we have no
 * route at all (e.g. an OpenSky-only flight that FR24 hasn't enriched yet).
 */
function route(f) {
  if (!hasOrigin(f) && !hasDest(f)) return null;
  return `${endpoint(f.originCity, f.originName, f.originIata)} → ${endpoint(f.destCity, f.destName, f.destIata)}`;
}

/** Pick the closest flight from a list (or null if empty). */
export function nearest(flights) {
  if (!flights.length) return null;
  return flights.reduce((a, b) => (b.distanceKm < a.distanceKm ? b : a));
}

/** Best human label for the operator: airline name, else callsign/flight number. */
function carrier(f) {
  return f.airline || f.callsign || f.flightNumber || "Unknown";
}

/**
 * Compact, presentable single line for the Touch Bar.
 * e.g.  "✈  IndiGo · DEL → BOM · A320neo · FL350 · 4.2 km"
 * Returns "" (empty) when nothing is overhead, so the Touch Bar stays clean.
 */
export function touchbarLine(flights) {
  const f = nearest(flights);
  if (!f) return "";
  const parts = [carrier(f)];
  // Only repeat the callsign when we led with an airline name (else it dupes).
  if (f.airline && f.callsign && f.callsign !== f.airline) parts.push(f.callsign);
  const r = route(f);
  if (r) parts.push(r);
  if (f.model) parts.push(f.model);
  parts.push(altStr(f.altitudeFt), distStr(f.distanceKm));
  return `✈  ${parts.join("  ·  ")}`;
}

/** Notification title: carrier + callsign, e.g. "✈ IndiGo · IGO6457". */
export function notifyTitle(f) {
  const cs = f.callsign || f.flightNumber;
  return `✈ ${carrier(f)}${cs && cs !== f.airline ? "  ·  " + cs : ""}`;
}

/**
 * Notification body, e.g.
 * "Mangalore → Delhi · Airbus A320 · FL090 · 3.6 km away".
 */
export function notifyBody(f) {
  const parts = [];
  const r = route(f);
  if (r) parts.push(r);
  if (f.model) parts.push(f.model);
  parts.push(altStr(f.altitudeFt));
  parts.push(`${distStr(f.distanceKm)} away`);
  return parts.join("  ·  ");
}
