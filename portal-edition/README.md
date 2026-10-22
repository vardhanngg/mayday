# MAYDAY Portal Edition (Poki prototype)

This is a separate, single-player release build based on MAYDAY v74.0, packaged as Portal Edition v75.0. It does not replace or deploy the main Render multiplayer game.

## What it includes

- **Dogfight:** fight local AI pilots and reach 10 drone kills to win.
- **Clash Squad:** a best-of-three solo squad trial against six AI aircraft per round, with three 7-second shield charges per round.
- **Survivor:** survive the AI arena with five lives and build the highest drone-kill count.
- **Practice:** free flight and AI target training with no score limit.
- **Flight Challenge:** five sequential precision-flight levels with arches, flags, fixed targets, unguided missiles, crash penalties and a completion screen.
- Local AI and assets; no online room, multiplayer socket, or friends connection is required.
- A local Three.js r128 bundle and local copies of the current audio assets.
- No AdSense metadata or third-party advertising code.
- Poki SDK initialization, gameplay lifecycle events, and commercial-break integration at selected progression points.

The original Render edition keeps its online multiplayer behavior. The Portal Edition's Dogfight, Clash Squad, and Survivor are deliberately adapted for solo play against AI rather than pretending that an online room is available.

## Build

From the repository root, run:

```sh
npm run build:portal
```

This installs the pinned `three@0.128.0` dependency in this folder and writes the uploadable static game to `portal-edition/dist/`.

For a clean local build without the root convenience script:

```sh
npm --prefix portal-edition install
npm --prefix portal-edition run build
```

Upload the **contents** of `portal-edition/dist/` to Poki for Developers / Poki Inspector. Do not upload `node_modules` or this source folder.

## Test before submitting

1. Test all five modes on desktop, then test mobile and tablet layouts in Poki Inspector.
2. Confirm all mode actions, combat objectives, the three Clash Squad round transitions, Survivor's lives, Flight Challenge progression, replay, and main-menu navigation.
3. Check the SDK Event Log, warnings, scaling, loading behavior, and incognito/private browsing with storage restricted.
4. Confirm rights to redistribute every sound and other non-code asset. The current audio files are copied from the main game; this build does not itself certify their licences.
5. Poki controls publication and ad serving. Earnings are not guaranteed; the platform must accept the game.
6. The Poki SDK script is the only expected external script and is part of the platform integration.

## Source and version

- Source baseline: MAYDAY v74.0
- Portal edition: v75.0-portal-all-modes
- Online multiplayer edition remains on the root project / `main` branch.
