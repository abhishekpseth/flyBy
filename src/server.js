import http from "node:http";
import { config } from "./config.js";
import { startPolling, snapshot } from "./poller.js";
import { touchbarLine } from "./format.js";

const server = http.createServer((req, res) => {
  const url = (req.url || "/").split("?")[0];

  if (url === "/touchbar") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(touchbarLine(snapshot.flights));
    return;
  }

  if (url === "/status") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(snapshot, null, 2));
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("flight-notifier: try /touchbar or /status\n");
});

// Bind to loopback only — this is a local helper, not a public service.
server.listen(config.PORT, "127.0.0.1", () => {
  console.log(`[server] listening on http://127.0.0.1:${config.PORT}`);
  console.log(`[server]   /touchbar  → one-line nearest plane`);
  console.log(`[server]   /status    → full JSON of in-radius flights`);
  startPolling();
});
