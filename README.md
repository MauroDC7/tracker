# OfficeMate Tracker

Standalone **privacy-first** desktop activity metadata agent for OfficeMate. It runs in the background, records **which** application and window are in the foreground (and optional **active tab URL/title** from Chrome via a companion extension), then batches that metadata to your Laravel API.

This repository is intentionally **separate** from the main Laravel codebase.

## Installatie en gebruik (Nederlands)

Volg deze stappen om de tracker **lokaal werkend** te krijgen. Daarna pas je de API aan je echte Laravel-backend aan.

1. **Vereisten**  
   - Node.js 20 of nieuwer  
   - Op Windows: na install soms `npx electron-rebuild` als `active-win` niet laadt (native module voor Electron).

2. **Desktop-app starten** (ontwikkeling)  
   ```bash
   npm install
   npm run build
   npm start
   ```  
   Je ziet een **systeemvak-icoon** (tray). Bij eerste start opent vaak het **inlogvenster**.

3. **Inloggen**  
   Vul e-mail en wachtwoord in. De app roept standaard `POST {REMOTE_API_BASE_URL}{REMOTE_LOGIN_PATH}` aan (zie `.env.example`). Je Laravel-API moet een token teruggeven in het veld `access_token` of `token`, en optioneel `user_id` / `user.id`.

4. **Chrome-extensie** (nodig voor browser-URL en tabtitel)  
   - Chrome → **Extensies** → **Ontwikkelaarsmodus** aan.  
   - **Uitgepakte extensie laden** → map **`extension/`** in deze repo kiezen.  
   - De extensie stuurt metadata naar **`http://127.0.0.1:3210/browser-event`**. De desktop-app luistert op die poort (**127.0.0.1**, niet alleen “localhost” in de firewall denken).  
   - Als je `LOCAL_BROWSER_API_PORT` in `.env` wijzigt, moet je dezelfde poort ook in `extension/background.js` (constante `LOCAL_ENDPOINT`) aanpassen.

5. **API-sync**  
   Periodiek stuurt de app batches naar `POST …/api/activity` (standaard) met body `{ "activities": [ … ] }`. Zorg dat je Laravel-route dit formaat accepteert en `Authorization: Bearer <token>` valideert.

6. **Tray**  
   - **Pauzeren / hervatten** tracking.  
   - **Aanmelden…** opnieuw openen.  
   - **Starten bij aanmelden** (Windows: pas echt zinvol na **geïnstalleerde** build; in dev wijst dit naar het Electron-binary).  
   - **Afsluiten**.

7. **Windows-installer bouwen**  
   ```bash
   npm run dist:win
   ```  
   Output staat in **`release/`**.

## What is collected (metadata only)

| Field | Source |
|--------|--------|
| `app_name` | OS / `active-win` (e.g. `Code.exe`, `chrome`) |
| `window_title` | OS window title |
| `browser_url` | Chrome extension, **active tab only** |
| `browser_domain` | Parsed hostname |
| `browser_tab_title` | Chrome tab title |
| `started_at`, `ended_at`, `duration_seconds` | Derived client-side |

**Never collected:** keystrokes, clipboard, screenshots, microphone/camera, DOM/page HTML, or background tab contents.

## Architecture decisions

1. **Electron main process** owns tracking, persistence, sync, and tray UX — one runtime users install.
2. **Chrome MV3 extension** posts JSON to `http://127.0.0.1:3210/browser-event`. This is the simplest stable MVP versus Native Messaging (fewer moving parts, easier debugging).
3. **Durable queue** (`userData/activity-queue.json`) backs the Axios sync so offline periods do not lose segments.
4. **Auth token** is stored under the app `userData` directory using Electron `safeStorage` when the OS provides it (typical on modern Windows and macOS).

See `PRIVACY.md` for GDPR-oriented notes and threat-model language you can reuse in a DPIA.

## Project layout

```
src/
  main/           # process bootstrap, tray, login window
  preload/        # hardened bridge for the login window only
  services/       # auth, loopback server, browser state, sync
  trackers/       # active window polling + heuristics
  api/            # Laravel HTTP client
  storage/        # queue + settings + encrypted auth blob
  ipc/            # IPC registration
  types/          # DTOs / interfaces
  utils/          # env loader, logger, URL helpers
static/           # login.html (loaded by Electron)
extension/      # Chrome MV3 bridge (load unpacked in developer mode)
assets/         # optional tray icon (icon.png) for development
```

## Prerequisites

- Node.js 20+
- Windows **x64** for the primary installer target (macOS/Linux targets are scaffolded in `electron-builder` for later hardening).
- On Windows, `active-win` ships native bindings; if Electron fails to load them, run `npx electron-rebuild` after install.

## Install and run (development)

```bash
npm install
npm run build
npm start
```

The tray icon appears (embedded 1×1 fallback, or `assets/icon.png` if you add one). Load the Chrome extension from `extension/` (see `extension/README.md`).

## Build Windows installer

```bash
npm run dist:win
```

Artifacts land in `release/`. The NSIS installer is configured in `package.json` under the `build` key.

## Configuration

Copy `.env.example` to `.env` at the project root for local development, or set OS environment variables in production.

| Variable | Purpose |
|-----------|---------|
| `REMOTE_API_BASE_URL` | e.g. `https://api.officemate.app` |
| `REMOTE_ACTIVITY_PATH` | default `/api/activity` |
| `REMOTE_LOGIN_PATH` | default `/api/login` |
| `LOCAL_BROWSER_API_PORT` | default `3210` |
| `ACTIVE_WINDOW_POLL_MS` | default `5000` |
| `SYNC_INTERVAL_MS` | default `60000` |
| `SYNC_BATCH_SIZE` | default `50` |

## Laravel API contract (expected)

### `POST /api/activity`

`Authorization: Bearer <token>`

```json
{
  "activities": [
    {
      "user_id": 1,
      "app_name": "Code.exe",
      "window_title": "Laravel Backend",
      "browser_url": "https://github.com/org/repo",
      "browser_domain": "github.com",
      "browser_tab_title": "org/repo",
      "started_at": "2026-05-11T14:00:00.000Z",
      "ended_at": "2026-05-11T14:05:00.000Z",
      "duration_seconds": 300
    }
  ]
}
```

`user_id` is optional on the wire if your backend resolves the user strictly from the token.

### `POST /api/login` (default)

The client posts JSON `{ "email": "...", "password": "..." }` and expects a JSON body containing `access_token` **or** `token`, and optionally `user_id` or `user.id` for activity payloads.

Point `REMOTE_LOGIN_PATH` at your Sanctum route if it differs.

## Local extension → desktop examples

### `POST http://127.0.0.1:3210/browser-event`

```bash
curl -sS -X POST http://127.0.0.1:3210/browser-event \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://github.com",
    "title": "GitHub",
    "domain": "github.com",
    "is_incognito": false,
    "observed_at": "2026-05-11T14:02:00.000Z"
  }'
```

The extension mirrors this payload automatically whenever the focused window’s active tab changes.

## Security notes

- The loopback server binds **127.0.0.1 only** — not exposed on the LAN.
- The extension only requests `tabs`, `activeTab`, and narrow `host_permissions` for the local port.
- Treat the auth token like a password: ship updates over HTTPS, rotate on compromise, and document retention in your privacy policy.

## License

Private / UNLICENSED — adjust to your organization’s policy.
