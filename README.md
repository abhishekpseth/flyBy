# FlyBy 🛫

> *Know what's flying overhead.*


A small always-on Node.js service that watches the sky around your location and:

1. **Pops a native macOS notification** (with a custom airline cabin chime) each time a *new*
   plane enters your radius.
2. **Continuously shows the nearest overhead plane on your MacBook Touch Bar** (via MTMR),
   with callsign, origin → destination, aircraft model, altitude, and distance.

It ships with a **one-click Dock app** to start/stop everything, so you never have to touch the
terminal after setup.

**How it sources data:** the official **OpenSky Network** API is the primary gate — every poll asks
it "is anything airborne within my radius?" (cheap, quota-based, reliable). Only when a plane is
actually overhead does it call the unofficial **FlightRadar24** SDK to enrich that plane with route
+ aircraft model. This keeps FR24 usage tiny, so it never gets rate-limited. If OpenSky is ever
unavailable, it falls back to FR24 for detection too.

> **Note:** paths in the Dock app and the launch agent are currently hard-coded to one machine.
> If you clone this, update them to your own checkout path — see [Make it your own](#make-it-your-own).

## Requirements

- Node.js 20.12+ (uses built-in `fetch` and `process.loadEnvFile`). Tested on Node 22.
- macOS (for notifications and the Dock app).
- A **free OpenSky Network account** for API access — see [Setup](#setup). (Anonymous access
  works but is capped at 400 credits/day, which frequent polling exhausts within hours.)
- A MacBook Pro with a physical Touch Bar + [MTMR](https://github.com/Toxblh/MTMR) for the Touch Bar display.
  (The notifications and the `/status` endpoint work without MTMR.)

## Setup

```bash
npm install
```

Copy the example env file and fill in your location:

```bash
cp .env.example .env
```

```ini
# .env
HOME_LAT=51.4700        # your latitude  (Apple Maps: right-click → copy coordinates)
HOME_LON=-0.4543        # your longitude
RADIUS_KM=15            # notify/display planes within this many km
POLL_SECONDS=30         # how often to poll (keep >= 22s to stay in OpenSky budget)
PORT=8787               # local HTTP port
ENRICH_DETAILS=true     # add route + aircraft model from FlightRadar24 on a hit
OPENSKY_CLIENT_ID=      # from your free OpenSky account (see below)
OPENSKY_CLIENT_SECRET=
# NOTIFY_SOUND=Glass    # optional: use a built-in macOS sound instead of the chime
```

`.env` is git-ignored, so your coordinates and credentials stay on your machine. All settings have
sensible defaults if omitted.

### OpenSky account (recommended)

OpenSky is the primary data source. A free account raises your quota from **400 → 4,000
credits/day**, enough for 30-second polling all day.

1. Register at [opensky-network.org](https://opensky-network.org/).
2. Go to **My OpenSky → Account → API clients** and create a client.
3. Copy the **client id** and **client secret** into `OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET`
   in your `.env`.

Each `/states/all` poll of a small area costs 1 credit, so `POLL_SECONDS=30` ≈ 2,880/day — well
under the 4,000 budget. On startup the server logs whether it's authenticated. Without credentials
it runs anonymously (400/day) and warns you.

## Usage

### One-click control (Dock app) — recommended

Drag **`FlyBy.app`** to your Dock. Clicking it opens a small dialog that knows whether the
tracker is already running:

- **Start** — launches the notifier service (detached) and opens MTMR.
- **Stop** — stops the service and quits MTMR (Touch Bar back to normal).
- **Cancel** — does nothing.

The relevant button is pre-selected for you (Start when it's off, Stop when it's on). You'll get a
macOS notification confirming each action.

### From the terminal

```bash
npm start          # run the service in the foreground
npm run fly        # "flight mode": start the service detached + open MTMR
npm run stop       # stop the service + quit MTMR
```

Check it works:

```bash
curl http://127.0.0.1:8787/touchbar   # → "✈ BA117 LHR→JFK A388 35,000ft 4.2km"
curl http://127.0.0.1:8787/status     # → full JSON of all in-radius flights
```

Tip: while testing, temporarily set `RADIUS_KM` to `50` so there's guaranteed traffic.

## Touch Bar (MTMR)

1. Install MTMR: `brew install --cask mtmr` (or download from the [MTMR releases](https://github.com/Toxblh/MTMR/releases)).
2. Launch MTMR once so it creates `~/Library/Application Support/MTMR/items.json`.
3. Merge the widget from [`mtmr/items.json`](mtmr/items.json) into that file (or copy the whole
   file if you don't have other widgets). The widget runs
   `curl -s http://127.0.0.1:8787/touchbar` every 5 seconds and shows the result. Tapping it opens
   flightradar24.com.
4. Restart MTMR (menu-bar icon → *Preferences/Quit* then relaunch). The nearest plane appears on
   the Touch Bar.

If you change the port in `.env`, update the URL in the MTMR widget to match.

## Notification sound

New-plane notifications play a custom airline cabin chime ([`assets/chime.wav`](assets/chime.wav)).
To use a built-in macOS sound instead (e.g. `Glass`, `Hero`, `Submarine`), set `NOTIFY_SOUND`
in your `.env`:

```ini
NOTIFY_SOUND=Glass
```

(Or pass it inline for a one-off: `NOTIFY_SOUND=Glass npm start`.) The chime itself can be
regenerated with `node scripts/make-chime.js`.

## Make it your own

A few things are pinned to the original author's machine — update them after cloning:

- **`FlyBy.app/Contents/MacOS/launcher`** — change the `PROJ=` path to your checkout location.
- **The app icon** can be regenerated with `swift scripts/make-icon.swift icon.png` (a white
  airplane on a blue gradient). See the comments in that file to tweak it.
- **The login launch agent** (below) — set the absolute paths to match your machine.

## Keep it running at login (optional)

Create `~/Library/LaunchAgents/club.30sundays.flightnotifier.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>club.30sundays.flightnotifier</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>            <!-- run `which node` to confirm path -->
    <string>/ABSOLUTE/PATH/TO/flightNotification/src/server.js</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/flightnotifier.log</string>
  <key>StandardErrorPath</key><string>/tmp/flightnotifier.err</string>
</dict>
</plist>
```

Then: `launchctl load ~/Library/LaunchAgents/club.30sundays.flightnotifier.plist`

## How it works

```
poller.js  ── every POLL_SECONDS ──▶  OpenSky /states/all   (primary gate, OAuth2)
                                              │                └─ on error ─▶ FR24 (fallback)
                          filter to circular radius (geo.js haversine)
                                              │
                       any planes in range?  ──no──▶  show nothing (FR24 never called)
                                              │ yes
                    FR24 SDK: match by icao24/callsign ─▶ graft route + aircraft model
                                              │
              diff vs tracked state ─▶ new entrants ─▶ macOS notification (notify.js)
                                              │
                          cache snapshot ─▶ served by server.js
                                              │
                       /touchbar (text)            /status (JSON)
                            ▲
                MTMR widget polls every 5s
```

FR24 is only touched when something is actually overhead, so its request volume stays tiny and it
never gets rate-limited — while OpenSky's reliable quota does the every-poll detection.

## Project layout

```
FlyBy.app/            one-click Dock launcher (Start/Stop dialog)
.env                  your location + polling settings (git-ignored; copy .env.example)
mtmr/items.json       Touch Bar widget definition
assets/chime.wav      notification chime
scripts/
  fly.sh              start service (detached) + open MTMR
  stop.sh             stop service + quit MTMR
  make-icon.swift     regenerate the Dock app icon
  make-chime.js       regenerate the notification chime
src/
  server.js           HTTP server: /touchbar and /status
  poller.js           polling loop + new-entrant diffing
  sources/            opensky.js (primary gate, OAuth2) + flightradar.js (enrich on hit)
  geo.js              haversine distance / radius filter
  format.js           Touch Bar text + notification formatting
  notify.js           macOS notifications + chime
  state.js            tracked-flight state
  config.js           loads .env
```

## Notes & limitations

- The FlightRadar24 SDK is **unofficial** (it scrapes FR24) and may rate-limit or return empty
  results. Because it's now only called when a plane is genuinely in range, that rarely happens —
  and when it does, the flight still shows with OpenSky data (callsign, altitude, distance), just
  without route/model until FR24 recovers.
- OpenSky credits reset daily (UTC). A registered account is 4,000/day; at `POLL_SECONDS=30` that's
  ~2,880 polls/day. Lowering `POLL_SECONDS` too far will exhaust the quota — keep it ≥ 22s.
- If you're right next to a busy airport, most nearby aircraft are on the ground (taxiing/parked);
  FlyBy filters those out and only shows **airborne** planes, so a small radius can look empty for
  stretches. Bump `RADIUS_KM` (15–30) to catch more overhead traffic.

## License

ISC. See `package.json`.
