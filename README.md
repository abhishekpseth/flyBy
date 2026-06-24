# FlyBy 🛫

> *Know what's flying overhead.*


A small always-on Node.js service that watches the sky around your location and:

1. **Pops a native macOS notification** (with a custom airline cabin chime) each time a *new*
   plane enters your radius.
2. **Continuously shows the nearest overhead plane on your MacBook Touch Bar** (via MTMR),
   with callsign, origin → destination, aircraft model, altitude, and distance.

It ships with a **one-click Dock app** to start/stop everything, so you never have to touch the
terminal after setup.

Data comes from the unofficial **FlightRadar24** SDK (rich: route + model), and automatically
falls back to the official free **OpenSky Network** API (callsign + altitude only) if FR24 fails.

> **Note:** paths in the Dock app and the launch agent are currently hard-coded to one machine.
> If you clone this, update them to your own checkout path — see [Make it your own](#make-it-your-own).

## Requirements

- Node.js 18+ (uses built-in `fetch`). Tested on Node 22.
- macOS (for notifications and the Dock app).
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
RADIUS_KM=8             # notify/display planes within this many km
POLL_SECONDS=20         # how often to poll (keep >= 15s to be polite to FR24)
PORT=8787               # local HTTP port
ENRICH_DETAILS=true     # fetch full model + airport names for nearest/new flights
# NOTIFY_SOUND=Glass    # optional: use a built-in macOS sound instead of the chime
```

`.env` is git-ignored, so your coordinates stay on your machine. All settings have sensible
defaults if omitted.

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
poller.js  ── every POLL_SECONDS ──▶  FR24 SDK  (primary)
                                       └─ on error ─▶ OpenSky  (fallback)
                                              │
                          filter to circular radius (geo.js haversine)
                                              │
              diff vs tracked state ─▶ new entrants ─▶ macOS notification (notify.js)
                                              │
                       enrich nearest+new with model/route (FR24 details)
                                              │
                          cache snapshot ─▶ served by server.js
                                              │
                       /touchbar (text)            /status (JSON)
                            ▲
                MTMR widget polls every 5s
```

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
  sources/            flightradar.js (primary) + opensky.js (fallback)
  geo.js              haversine distance / radius filter
  format.js           Touch Bar text + notification formatting
  notify.js           macOS notifications + chime
  state.js            tracked-flight state
  config.js           loads .env
```

## Notes & limitations

- The FlightRadar24 SDK is **unofficial** (it scrapes FR24) and may rate-limit or break. The
  OpenSky fallback keeps the tool working — with reduced detail (no route/model) — when that
  happens. Polling at 20s and enriching only the nearest/new flights keeps request volume low.
- OpenSky anonymous access is ~400 credits/day; a small bounding box at 20s polling stays within
  budget.
- For best results keep `RADIUS_KM` modest (5–10 km) so "overhead" actually means overhead.

## License

ISC. See `package.json`.
