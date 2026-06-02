# OfficeMate Tracker

Standalone **privacy-first** desktop activity metadata agent for OfficeMate. It runs in the background, records **which** application and window are in the foreground, then batches that metadata to your Laravel API.

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

4. **API-sync**  
   Periodiek stuurt de app batches naar `POST …/api/activity` (standaard) met body `{ "activities": [ … ] }`. Zorg dat je Laravel-route dit formaat accepteert en `Authorization: Bearer <token>` valideert.

5. **Tray**  
   - **Pauzeren / hervatten** tracking.  
   - **Aanmelden…** opnieuw openen.  
   - **Starten bij aanmelden** (Windows: pas echt zinvol na **geïnstalleerde** build; in dev wijst dit naar het Electron-binary).  
   - **Afsluiten**.

6. **Windows-installer bouwen**  
   ```bash
   npm run dist:win
   ```  
   Output staat in **`release/`**.

## What is collected (metadata only)

| Field | Source |
|--------|--------|
| `app_name` | OS / `active-win` (e.g. `Code.exe`, `chrome`) |
| `window_title` | OS window title |
| `browser_url`, `browser_domain`, `browser_tab_title` | Altijd `null` (niet verzameld) |
| `started_at`, `ended_at`, `duration_seconds` | Derived client-side |

**Never collected:** keystrokes, clipboard, screenshots, microphone/camera, DOM/page HTML, browser URLs, or background tab contents.

## Architecture decisions

1. **Electron main process** owns tracking, persistence, sync, and tray UX — one runtime users install.
2. **Durable queue** (`userData/activity-queue.json`) backs the Axios sync so offline periods do not lose segments.
3. **Auth token** is stored under the app `userData` directory using Electron `safeStorage` when the OS provides it (typical on modern Windows and macOS).

See `PRIVACY.md` for GDPR-oriented notes and threat-model language you can reuse in a DPIA.

## Project layout

```
src/
  main/           # process bootstrap, tray, login window
  preload/        # hardened bridge for the login window only
  services/       # auth, sync, diagnostics
  trackers/       # active window polling
  api/            # Laravel HTTP client
  storage/        # queue + settings + encrypted auth blob
  ipc/            # IPC registration
  types/          # DTOs / interfaces
  utils/          # env loader, logger
static/           # login.html (loaded by Electron)
assets/         # Logo.png (bron) → npm run icons → tray, dock, installer
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

Place **`Logo.png`** (of `logoTransparent.png`) in `assets/`, then run `npm run icons` (runs automatically before `npm start` / build). Tray, dock en installer gebruiken hetzelfde gradient-logo.

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
      "browser_url": null,
      "browser_domain": null,
      "browser_tab_title": null,
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

## Security notes

- Treat the auth token like a password: ship updates over HTTPS, rotate on compromise, and document retention in your privacy policy.

## License

Private / UNLICENSED — adjust to your organization’s policy.
