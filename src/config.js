import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, "..", ".env");

// Load .env into process.env (built-in, Node 20.12+ / 22).
// Safe if the file is absent — we just fall back to the real environment / defaults.
try {
  process.loadEnvFile(ENV_PATH);
} catch {
  /* no .env file — that's fine */
}

const num = (v, d) =>
  v === undefined || v === "" || Number.isNaN(Number(v)) ? d : Number(v);
const bool = (v, d) =>
  v === undefined || v === "" ? d : /^(1|true|yes|on)$/i.test(v.trim());

const config = {
  HOME_LAT: num(process.env.HOME_LAT, 0),
  HOME_LON: num(process.env.HOME_LON, 0),
  RADIUS_KM: num(process.env.RADIUS_KM, 8),
  POLL_SECONDS: num(process.env.POLL_SECONDS, 20),
  PORT: num(process.env.PORT, 8787),
  ENRICH_DETAILS: bool(process.env.ENRICH_DETAILS, true),
};

if (config.HOME_LAT === 0 && config.HOME_LON === 0) {
  console.warn(
    "[config] HOME_LAT/HOME_LON are still 0,0 — set them in .env " +
      "(copy .env.example to .env; Apple Maps: right-click → copy coordinates).",
  );
}

export { config };
