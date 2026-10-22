# MAYDAY Portal Edition (Poki prototype)

This is a separate, single-player release build derived from MAYDAY v74.0. It does not replace or deploy the main Render multiplayer game.

## What it includes

- Solo Flight Challenge only: five sequential course levels, arches, flags, fixed targets, unguided missiles, collision penalties, and a mission-complete screen.
- A local Three.js r128 bundle and local copies of the current audio assets.
- No AdSense metadata or third-party advertising code.
- Backend and friends/socket entry points disabled in this edition.
- Poki SDK initialization, gameplay lifecycle events, and commercial-break calls at level transitions, crash resets, and replay.

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

## Important before submitting publicly

1. Open the output in Poki Inspector and pass the mobile, tablet, desktop, scaling, SDK-event, loading and external-resource checks. Responsive layout and SDK event behavior still need real Inspector validation.
2. Confirm rights to redistribute every sound and other non-code asset. The current audio files are copied from the main game; this build does not itself certify their licences.
3. Test in incognito/private browsing with storage restricted, and test game-over/replay/home controls and full mission progression on low-end devices.
4. Poki controls publication and ad serving. Earnings are not guaranteed; the platform must accept the game.
5. The Poki SDK script is the only expected external script. It is part of the platform integration and is intentionally not bundled locally.

## Source and version

- Source baseline: MAYDAY v74.0
- Portal edition: v74.0-portal-edition
- Online multiplayer edition remains on the root project / `main` branch.
