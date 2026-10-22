# MAYDAY

MAYDAY is a browser-based 3D aircraft game with online multiplayer modes and a solo Flight Challenge.

## Editions

- **Online edition:** the existing Render-hosted multiplayer game, served by `server.js` from `public/`.
- **Portal Edition:** a separate single-player-only build for portal testing. See [portal-edition/README.md](portal-edition/README.md). It is built from the current source, vendors Three.js and audio locally, disables backend-dependent flows, and adds the Poki SDK lifecycle integration.

## Commands

- `npm start` — run the online edition server.
- `npm run check` — syntax-check the online server and client.
- `npm run build:portal` — build the static Portal Edition into `portal-edition/dist/`.

Do not deploy the `portal-edition-poki` branch to the production Render service. Use its `portal-edition/dist/` contents only for portal review after running the build and QA steps in the portal guide.
