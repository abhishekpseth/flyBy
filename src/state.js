/**
 * Tracks which planes are currently inside the radius so we can detect *new*
 * entrants (for one-shot notifications) and forget planes that have left.
 */
const present = new Map(); // id -> last-seen flight
let primed = false; // first tick only seeds state, so we don't notify for everything overhead at startup

/**
 * Update tracked state with the current in-radius flights.
 * Returns the subset that are newly present since the last tick.
 * The first call returns [] (state is primed silently) to avoid a burst of
 * notifications for every plane already overhead when the service starts.
 */
export function diffNewEntrants(flights) {
  const seen = new Set();
  const newEntrants = [];

  for (const f of flights) {
    seen.add(f.id);
    if (!present.has(f.id)) newEntrants.push(f);
    present.set(f.id, f);
  }

  // Drop planes that have left the radius.
  for (const id of present.keys()) {
    if (!seen.has(id)) present.delete(id);
  }

  if (!primed) {
    primed = true;
    return [];
  }
  return newEntrants;
}
