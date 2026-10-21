# MAYDAY v65.0 — Online-ready browser multiplayer + reliable room exit

This build prepares the v63 game for a public WebSocket-capable Node host.

## What's changed

- Uses `PORT` supplied by the host and binds to `0.0.0.0`.
- Browser game and friends sockets automatically use `wss://` on HTTPS hosting.
- Adds `GET /healthz` for host health checks.
- Adds WebSocket ping/pong keepalive and stale-connection cleanup.
- Bounds incoming WebSocket payloads and disables per-message compression to avoid unnecessary resource usage.
- Uses `MAYDAY_DATA_DIR` to store the `social.json` file on a persistent cloud volume.
- Sends a restart notice before closing WebSocket connections on SIGTERM/SIGINT.
- Reduces room-list broadcast frequency to once per second; live snapshots remain at 20 Hz.
- `data/social.json` is excluded from Git by `.gitignore`.

## Important limitations before inviting people

- Room state, match state and reconnect sessions are stored in memory. A host restart/redeploy ends active rooms. Use one service instance only; adding horizontal instances would split players across independent room registries.
- This remains a friends-and-family test build, not a production-hardened public release. Server-authoritative validation, abuse protections and room/session controls need a separate security pass before advertising it widely.
- The free Render configuration is useful for testing but its filesystem is ephemeral. Game UIDs/friendships stored in `data/social.json` may be lost after an instance restart, redeploy or spin-down. Render free web services can also spin down after 15 minutes without inbound traffic, and waking can take about a minute.
- For persistent Game UIDs/friendships, use `render-persistent.yaml` or configure a paid persistent disk manually. This creates a paid resource; check Render's current pricing before confirming it.
- The deployed online server starts with its own social database. A local `data/social.json` is never included in this source package. Do not commit it to GitHub. Importing local profiles requires transferring it securely to the persistent volume before first use; this package does not automatically migrate local identities.

## Local run

```bash
npm install
npm start
```

Open `http://localhost:3000`, or use the printed LAN URL from another device on the same network.

Check version/health:

- `/api/version`
- `/healthz`

## Deploy to Render from GitHub

1. Create a dedicated **private** GitHub repository for MAYDAY (recommended name: `mayday-online`).
2. Upload/push the contents of this folder to that repo. Do not upload `data/social.json`, `node_modules`, or `.env` files.
3. In Render, choose **New → Blueprint Instance** and connect that repository.
4. For no-cost temporary testing, use the default `render.yaml` (free, but the caveats above apply).
5. For persistent UIDs/friendships, choose `render-persistent.yaml` as the Blueprint file during setup if prompted, or copy its service settings into the Dashboard. That configuration uses a paid service and a 1 GB persistent disk.
6. Choose Singapore for lower expected latency from India, keep a single instance, then deploy.
7. Open the generated `https://<service>.onrender.com` URL. The client automatically uses secure `wss://` for real-time gameplay on HTTPS.
8. Share that exact URL with friends. Everyone must use the same hosted URL; `localhost` only refers to each person's own computer.
9. Verify `/healthz` returns `{"status":"ok",...}` and `/api/version` reports `v64.0-online-ready` before joining a test room.

## What is and isn't persisted

- `data/social.json`: persisted only when the chosen host storage is persistent and `MAYDAY_DATA_DIR` points to it.
- Active rooms/matches: in-memory only; lost on server restart/redeploy.
- HUD/mobile settings: browser-local `localStorage`; they remain per browser/device and do not sync across devices.

## Checks

Run `npm run check` to syntax-check both JavaScript files.


## v65.0 room exit fix

Home navigation is made resilient for both room leave and results-screen exit. The client now exposes the lobby before cleanup, catches cleanup errors, disables further handling on the previous game socket, and reasserts the lobby view after the next frames. The HTML script URL includes the v65 cache-buster.
