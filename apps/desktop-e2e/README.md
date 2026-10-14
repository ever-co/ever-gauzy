# Desktop end-to-end tests

Drive the **packaged Gauzy desktop apps** (Electron) with Playwright over the Chrome DevTools Protocol, against a
real Gauzy API.

## `desktop-timer.spec.ts` — the desktop timer's main flow

1. **API** — the suite starts the built API on a fresh SQLite database with the demo seed and waits until the seed
   reports success. As an admin it sets the employee's organization to an **enforced 1-minute screenshot interval**
   (the shortest the product offers) and **no inactivity check** (an unattended machine is idle, which would make the
   app stop the timer) — the same organization update the settings page makes.
2. **First start → setup wizard**: Welcome → "Custom / Network" → ActivityWatch and Wakatime off → API host + port →
   Save. Saving makes the app relaunch itself (`app.relaunch()` + `app.exit()`); the suite follows the relaunched
   process, which gets the same command line (user data, DevTools port).
3. **Login** as the demo seed's employee (`employee@ever.co`), typed key by key; Log In must become enabled.
4. **Start** → `POST /api/timesheet/timer/start`, and the capture taken at start is uploaded
   (`POST /api/timesheet/screenshot`, one upload per display).
5. **One screenshot interval later** the next capture is uploaded too.
6. **Stop** → `POST /api/timesheet/timer/stop`.
7. **The API has it**: exactly one stopped `DESKTOP` time log of the run, its time slots, at least two screenshot
   rows from at least two capture moments, and every screenshot's file and thumbnail is served (`200`, `image/*`)
   and exists in the API's upload directory.

## `desktop-apps-start.spec.ts` — every packaged app starts

Each packaged desktop app (timer, desktop, server, server-api, agent, server-mcp) starts on a fresh profile and opens
its first window without a main-process load error. An app that is not packaged is skipped.

## Run it

Needs the built API and the packaged app(s). Windows shown; on Linux/macOS use the `--linux`/`--mac` targets:

```bash
yarn build:api                      # dist/apps/api
yarn build:desktop-timer            # dist/apps/desktop-timer
yarn electron-builder -c.electronVersion=44.7.0 build --windows --x64 --dir --project dist/apps/desktop-timer
                                    # dist/apps/desktop-timer-packages/win-unpacked/Gauzy Desktop Timer.exe
yarn nx e2e desktop-e2e             # or: npx playwright test -c apps/desktop-e2e/playwright.config.ts [spec] [--grep app]
DESKTOP_E2E_API=off yarn nx e2e desktop-e2e -- desktop-apps-start   # start-up checks only, no API
```

The API runs as `dist/apps/api/main.js` on port `3131` (SQLite, `DEMO=true`, Redis and the worker queue off,
throw-away JWT secrets), in a working directory of its own under the run directory: the demo seed's clean-up of
`apps/api/public/screenshots` and the uploaded screenshots never touch the checkout. Its output goes to
`<run dir>/api.log`. The demo seed takes several minutes (much longer on a busy machine) and a few GB in the run
directory (it copies sample screenshots for every seeded time slot); `DESKTOP_E2E_DEMO=false` seeds only the
default data — same accounts, a fraction of the time.

| variable | default | |
|---|---|---|
| `DESKTOP_E2E_RUN_DIR` | `dist/desktop-e2e/<timestamp>` | API database + uploads + log, app user data and logs, step screenshots, `recorded.json`, report |
| `DESKTOP_E2E_API_URL` | — | use an API that is already running (with the demo seed) instead of starting one |
| `DESKTOP_E2E_API` | — | `off`: start no API (enough for `desktop-apps-start.spec.ts`) |
| `DESKTOP_E2E_DEMO` | `true` | `false`: seed only the default data |
| `DESKTOP_E2E_API_TIMEOUT_MINUTES` | `60` | budget for the API start + demo seed |
| `DESKTOP_E2E_API_PORT` | `3131` | port of the API the suite starts |
| `DESKTOP_E2E_API_MAIN` | `dist/apps/api/main.js` | the API build to start |
| `DESKTOP_E2E_DIST` | `dist` | where the built desktop apps and their `--dir` packages are |
| `DESKTOP_TIMER_EXECUTABLE` | from the built manifest | the packaged desktop timer |
| `DESKTOP_TIMER_APP_DIR` + `DESKTOP_TIMER_ELECTRON` | — | instead: an unpacked app directory run by an Electron binary |
| `DESKTOP_E2E_ADMIN_EMAIL` / `_PASSWORD`, `DESKTOP_E2E_EMPLOYEE_EMAIL` / `_PASSWORD` | demo seed defaults | accounts |

On Windows the run directory must be on the same drive as the API build (TypeORM resolves the migration paths
against the working directory's drive); the suite stops with a message if it is not.

The tests need an interactive desktop session (the timer captures the screen with Electron's `desktopCapturer`);
they are not wired into CI.

## How the apps are driven

The suite starts the app itself with a fixed `--remote-debugging-port` and attaches Playwright with `connectOverCDP`
once the window it needs exists. Playwright's `_electron.launch` attaches before the first window and holds every new
renderer at its start; in the timer's `nodeIntegration` windows that made `window.require()` of file modules
(`@electron/remote`, `electron-log`) throw `TypeError: no access` (Electron 44, Node 24.21), so the time-tracker
window never came up. Attaching later leaves those renderers alone, and lets the app relaunch itself for real.

## What it changes on the machine, and how it puts it back

- **Own user data per app** (`--user-data-dir=<run dir>/<app>-user-data`): an installed Gauzy app's settings, database
  and single-instance lock are not touched, and it may keep running.
- **No internet**: `--proxy-server` points at a local proxy that refuses every request (403) and records the host;
  requests to loopback addresses — the API on `127.0.0.1` — bypass it. Node's HTTP stack in the main process and in
  the processes the app forks (e.g. the updater's GitHub release lookup with `node-fetch`) ignores `--proxy-server`;
  it is sent to the same proxy with `NODE_USE_ENV_PROXY=1` + `HTTP_PROXY`/`HTTPS_PROXY`, loopback in `NO_PROXY`.
  No update check against GitHub, no update download, no telemetry; the hosts the app tried to reach are printed at
  the end. (A closed port is not enough on Windows: a refused connection takes seconds there, and the startup window
  then took minutes.)
- **`--mute-audio`**: the timer plays a camera-shutter sound for every screenshot.
- **Windows registry**: on its first start an app registers itself as a login item (`HKCU\…\CurrentVersion\Run`,
  `…\Explorer\StartupApproved\Run`, a value named after its app id — the same value an installed release uses) and
  as its protocol handler (`HKCU\Software\Classes\gauzy-timer` and the other apps' protocols). The suite exports
  those keys before the first start and afterwards puts back exactly what changed (in the Run keys only the Gauzy
  apps' own values — other programs' login items are neither compared nor touched — and the whole protocol key),
  then checks that nothing differs. If a run is killed before its clean-up, the
  installed app's login item and protocol point at the test build until that app starts again (or fix them in
  `regedit`).
- **Processes**: the app is quit at the end; then the process tree it was started as (off Windows: its process
  group) and whatever of the run is left — a relaunched app, a forked API — is stopped: processes started with the
  run's `--user-data-dir`, and for a packaged app the processes running from the build under test (its executable
  on Windows, its directory / `.app` bundle on Linux / macOS), with their descendants. A shared Electron binary
  (`DESKTOP_TIMER_APP_DIR` mode) is never matched on, so other apps running from it are left alone. The API is
  stopped by the global setup's teardown.
- **The test database**: the organization's timer settings above.
