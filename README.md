# MAYDAY

MAYDAY is a browser-based 3D aircraft combat game with online Dogfight, Clash Squad, Survivor, Practice, and Flight Challenge modes.

## Online matchmaking

In Dogfight, Clash Squad, or Survivor, players can choose:

- **PLAY ONLINE** — enter automatic matchmaking. The queue prioritizes available players, starts a match after the normal wait, and may fill empty slots with computer-controlled pilots so a single player can still play.
- **PLAY WITH FRIENDS** — create a private room, then invite online friends through the friends sidebar. Private rooms remain human-only.
- **JOIN PRIVATE ROOM** — join an existing room with its four-character code.

Default matchmaking targets are 8 pilots for Dogfight, 8 for Clash Squad (balanced across two teams by default), and 6 for Survivor. A supplied pool of 5,000 unique pilot names is shuffled by random selection; names are kept unique across active rooms where possible. The matchmaking panel shows a brief notice that computer-controlled pilots may be used, while the in-match roster avoids disruptive AI labels for immersion. Server-side simulation controls movement, firing, damage, kills, rounds, and scores.

Queue state is held in server memory and does not persist through a server restart. Online matchmaking requires the matching client and server build to be deployed together. Practice and Flight Challenge remain solo modes and do not enter online queues.

## Development and testing

```sh
npm install
npm run check
npm run test:matchmaking
npm start
```

The integration tests launch a temporary local MAYDAY server and verify queue cancellation, solo matchmaking, server-side pilot movement, random unique names from the supplied pool, late-player backfill, two-human Dogfight/Survivor matchmaking, and balanced Clash Squad teams.

`MAYDAY_MATCHMAKING_TIMEOUT_MS` is a test/development override for the queue timeout. Production defaults are 20 seconds for Dogfight and Survivor and 25 seconds for Clash Squad.

## Rollout

Randomized pilot names are developed on `feature/natural-pilot-names`. Review and test the branch before merging or deploying. Changes remain isolated from production until merged/deployed.
