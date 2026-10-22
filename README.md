# MAYDAY

MAYDAY is a browser-based 3D aircraft combat game with online Dogfight, Clash Squad, Survivor, Practice, and Flight Challenge modes.

## Online matchmaking

In Dogfight, Clash Squad, or Survivor, players can now choose:

- **PLAY ONLINE** — enter automatic matchmaking. MAYDAY fills a match as players arrive; when the queue is quiet, it starts a smaller match after a short wait, provided at least two pilots are available.
- **PLAY WITH FRIENDS** — create a private room, then invite online friends through the friends sidebar.
- **JOIN PRIVATE ROOM** — join an existing room with its four-character code.

Default matchmaking targets are 8 pilots for Dogfight, 8 for Clash Squad (balanced across two teams by default), and 6 for Survivor. Matchmaking queues are held in server memory; active queued searches do not persist through a server restart. Online matchmaking requires the matching client and server build to be deployed together.

Practice and Flight Challenge remain solo modes and do not enter online queues.

## Development and testing

```sh
npm install
npm run check
npm run test:matchmaking
npm start
```

The integration tests start a temporary local MAYDAY server and verify queue cancellation, automatic Dogfight and Survivor starts, and balanced partial Clash Squad matches.

`MAYDAY_MATCHMAKING_TIMEOUT_MS` is a test/development override for the queue timeout. Production defaults are 20 seconds for Dogfight and Survivor and 25 seconds for Clash Squad.

## Rollout

Automatic matchmaking is developed on `feature/automatic-matchmaking`. Review and test that branch before merging or deploying. The production `main` branch and Render deployment are not changed by this feature branch alone.
