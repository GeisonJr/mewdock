# Mewdock

A pixel-art cat that lives in the empty strip next to the macOS Dock. It idles, plays, stretches and naps, and reacts when you click it.

## Use

- The cat sits in a transparent, always-on-top window at the bottom corner of the main display. Clicks outside the cat pass through to whatever is behind it.
- Click the cat for a random reaction.
- Menu bar icon: Pause, Left or Right of the Dock (remembered), Start at Login (off by default, uses a LaunchAgent), Quit.

## Develop

Requires the versions in `.tool-versions` (Node.js and Rust, via asdf) and Xcode on macOS.

```sh
pnpm install
pnpm dev          # run with hot reload
pnpm typecheck    # tsc and cargo check
pnpm test         # node tests for the cat, cargo tests for the shell
pnpm install:mac  # build Mewdock.app and copy it to /Applications
pnpm icons        # regenerate app and tray icons from the sprite data
```

The app is not signed with a Developer ID, so a copy built on another Mac may be blocked by Gatekeeper.

## Layout

- `src/cat/`: sprites, behaviors and drawing, framework free.
- `src/main.ts`: canvas loop, clicks, tray events, sends the cat's bounds to Rust.
- `src-tauri/`: window placement, click-through, tray menu, settings, start at login.
- `docs/adr/`: decisions.
