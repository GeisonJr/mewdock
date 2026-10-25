# 0001. Use Tauri for the desktop shell

- Status: Accepted
- Date: 2026-10-24

## Context

Mewdock is a small always-on-top pet in a transparent window with a tray menu and a start at login option. It targets macOS first but must later run on Windows and Linux. It runs all day, so memory, CPU and bundle size matter more than usual.

## Decision

Use Tauri 2: a Rust shell (window placement, click-through, tray, autostart plugin) and a web frontend (TypeScript, Vite, one canvas) for the cat. The cat logic stays in plain TypeScript with no framework.

## Consequences

- One codebase for macOS, Windows and Linux, with transparent windows, tray icons and start at login supported by Tauri and its official plugins.
- Uses the system webview (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux): the bundle is a few MB and idle memory is low.
- Needs a Rust toolchain to build. Transparent windows on macOS need the `macos-private-api` feature, which rules out the Mac App Store.
- Linux has no reliable transparency or "always on top" on every compositor (Wayland especially), so that port needs testing per desktop.
- Rejected: Electron (bundles Chromium, about 100 MB and much more memory for a desktop pet); native Swift/AppKit (best macOS fit, but no path to Windows or Linux); Flutter desktop (transparent windows and tray need third-party plugins of uneven quality); Godot (good for sprites, weak tray and window-level control).
