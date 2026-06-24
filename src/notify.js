import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { notifyTitle, notifyBody } from "./format.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHIME = join(__dirname, "..", "assets", "chime.wav");
// Set NOTIFY_SOUND to a built-in macOS sound name (Glass, Hero, Submarine, …)
// to use that instead of the custom cabin chime.
const SYSTEM_SOUND = process.env.NOTIFY_SOUND || null;

/** Play the custom airline cabin chime (or a system sound if configured). */
function playSound() {
  if (!SYSTEM_SOUND && existsSync(CHIME)) {
    execFile("/usr/bin/afplay", [CHIME], () => {});
    return;
  }
  const name = SYSTEM_SOUND || "Glass";
  execFile("/usr/bin/afplay", [`/System/Library/Sounds/${name}.aiff`], () => {});
}

let notifier = null;
try {
  notifier = (await import("node-notifier")).default;
} catch {
  notifier = null; // fall back to osascript
}

/** Fire a single native macOS notification for a newly-seen flight. */
export function notifyNewFlight(flight) {
  const title = notifyTitle(flight);
  const message = notifyBody(flight);

  // Play our own sound so we control it precisely; keep the banner itself silent.
  playSound();

  if (notifier) {
    notifier.notify({ title, message, sound: false });
    return;
  }
  // Fallback: built-in osascript (no extra dependency required).
  const escape = (s) => String(s).replace(/"/g, '\\"');
  const script = `display notification "${escape(message)}" with title "${escape(title)}"`;
  execFile("osascript", ["-e", script], (err) => {
    if (err) console.warn(`[notify] osascript failed: ${err.message}`);
  });
}
