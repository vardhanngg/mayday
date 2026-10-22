# MAYDAY

MAYDAY is a browser-based 3D aircraft combat game with online Dogfight, Clash Squad, Survivor, Practice, and Flight Challenge modes.

## Online matchmaking

In Dogfight, Clash Squad, or Survivor, players can choose:

- **PLAY ONLINE** — enter automatic matchmaking. Real pilots are prioritized while a queue forms. If the queue remains quiet, the server starts the match with AI pilots filling empty slots, including when one person is searching alone.
- **PLAY WITH FRIENDS** — create a private room, then invite online friends through the friends sidebar. Private rooms remain human-only.
- **JOIN PRIVATE ROOM** — join an existing room with its four-character code.

Default matchmaking targets are 8 pilots for Dogfight, 8 for Clash Squad (balanced across two teams by default), and 6 for Survivor. AI pilots are created and controlled by the game server, so their flight movement, hits, kills, lives, round outcomes, and scores are shared across clients. They are labelled with an `AI` callsign in the game and result lists. Queue state is held in server memory and does not persist through a server restart. Online matchmaking requires the matching client and server build to be deployed together.

Practice and Flight Challenge remain solo modes and do not enter online queues. This AI fill is only for quick-match rooms; it does not add bots to private rooms.

## Development and testing

```sh
npm install
npm run check
npm run test:matchmaking
npm start
```

The integration tests launch a temporary local MAYDAY server and verify queue cancellation, one-human AI fill, server-side AI movement, two-human Dogfight/Survivor matchmaking, and balanced human and AI teams in Clash Squad.

`MAYDAY_MATCHMAKING_TIMEOUT_MS` is a test/development override for the queue timeout. Production defaults are 20 seconds for Dogfight and Survivor and 25 seconds for Clash Squad.

## Rollout

Automatic matchmaking and AI fill are developed on `feature/automatic-matchmaking`. Review and test that branch before merging or deploying. The production `main` branch and Render deployment are not changed by this feature branch alone.
