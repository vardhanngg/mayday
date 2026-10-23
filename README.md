# MAYDAY

MAYDAY is a browser-based 3D aircraft combat game with online Dogfight, Clash Squad, Survivor, Practice, and Flight Challenge modes.

## Online matchmaking

In Dogfight, Clash Squad, or Survivor, players can form an online party directly from the main lobby:

- **Party lobby** — the leader can invite up to three accepted online friends before selecting a mode. All clients receive the server-authoritative party roster.
- **PLAY ONLINE** — the leader starts public matchmaking for the entire party. Dogfight and Survivor party members are opponents in the same match; Clash Squad keeps the party together on one team.
- **ROOM** — create a private room or join one with its four-character code. Private rooms remain a separate path from public matchmaking.
- **Practice** — solo training remains available; party practice is being introduced separately from public queues.

Default matchmaking targets are 8 pilots for Dogfight, 8 for Clash Squad (balanced across two teams by default), and 6 for Survivor. Simulated pilots display just one first name from the supplied 5,000-name pool, with duplicate active names avoided where possible. Human pilots use their entered or saved profile name; a default “Pilot” placeholder does not overwrite a saved name. A subtle notice says matches may include computer-controlled pilots, while individual roster entries are not AI-labelled. Server-side simulation controls movement, firing, damage, kills, rounds, and scores. Queue backfill waits when another recent player is still searching so nearby arrivals can be grouped into the same match.

Queue state is held in server memory and does not persist through a server restart. Online matchmaking requires the matching client and server build to be deployed together. Practice and Flight Challenge remain solo modes and do not enter online queues.

## Development and testing

```sh
npm install
npm run check
npm run test:matchmaking
npm start
```

The integration tests launch a temporary local MAYDAY server and verify queue cancellation, solo matchmaking, server-side pilot movement, first-name-only bot identities, saved human-profile names, staggered queue arrivals, shared backfill, two-human Dogfight/Survivor matchmaking, and balanced Clash Squad teams.

`MAYDAY_MATCHMAKING_TIMEOUT_MS` is a test/development override for the queue timeout. Production defaults are 20 seconds for Dogfight and Survivor and 25 seconds for Clash Squad.

## Rollout

The v77.1 pilot-name and matchmaking fixes are on `fix/pilot-first-names-and-matchmaking`. Merge and deploy the matching client/server build together; these changes do not deploy to Render automatically.
