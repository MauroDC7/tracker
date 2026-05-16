# OfficeMate Tracker — Chrome bridge (MV3)

## Install (developer mode)

1. Build or install the **OfficeMate Tracker** desktop app so the local API is listening on port **3210** (configurable via `LOCAL_BROWSER_API_PORT`).
2. Chrome → **Extensions** → enable **Developer mode**.
3. **Load unpacked** → select this `extension/` directory.

## What it sends

Only the **active** tab in the **focused** window:

- `url`, `title`, `domain`
- `is_incognito` (always filtered out server-side if true)
- `observed_at` timestamp

It does **not** read page body, does not run on inactive/hidden tabs, and skips non-`http(s)` schemes (`chrome://`, PDF viewers, etc., depending on URL).

## Permissions rationale

| Permission | Why |
|-------------|-----|
| `tabs` | Discover the active tab in the focused window. |
| `activeTab` | Aligns with user gesture expectations for MV3 patterns. |
| `host_permissions` for `http://127.0.0.1:3210/*` | `fetch` to the desktop agent (narrow, local-only). |

`<all_urls>` is intentionally **not** requested.

## Troubleshooting

- If events never arrive, confirm the desktop app is running and nothing else is bound to the port.
- Corporate proxies generally do not affect `127.0.0.1` traffic.
- After changing the port in `.env`, update `LOCAL_ENDPOINT` in `background.js` to match.
