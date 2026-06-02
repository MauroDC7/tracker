# Timmetraq Tracker — Privacy & GDPR notes

## Purpose limitation

Timmetraq Tracker exists to help organizations understand **time spent in applications** for workforce analytics, billing, or compliance workflows. It is **not** designed for covert surveillance: it avoids content capture by design.

## Lawful basis (GDPR)

Depending on deployment, typical bases are:

- **Article 6(1)(f) legitimate interests** of the employer (e.g. security, productivity measurement), balanced against employee rights; or
- **Article 6(1)(b) contract** where time tracking is part of the employment relationship.

You should record the chosen basis in your Records of Processing Activities and employee-facing policy.

## Data categories

**Personal data** may include window titles, which can reveal health, union membership, religion, or other special categories if employees visit sensitive sites. **Metadata-only tracking reduces risk versus full page capture**, but it is not zero risk. Mitigations:

- Transparent policy and in-product notice.
- Purpose limitation (no selling, no unrelated analytics).
- Retention limits on the Laravel side.
- Access controls and audit logs on the API.

## Why metadata-only is materially safer

| Risky capability | Timmetraq Tracker |
|-------------------|---------------------|
| Keystroke logging | **Not implemented** |
| Screenshots / screen recording | **Not implemented** |
| Page HTML / DOM scraping | **Not implemented** |
| Browser URL / tab tracking | **Not implemented** |
| Background tab surveillance | **Not implemented** |

## Employee transparency

Deploy this alongside:

1. A written policy describing what is collected, why, retention, and who can access it.
2. A visible indicator the tracker is running (tray icon).
3. A support channel for questions and data subject requests.

## Data subject rights

Your Laravel backend remains the **controller** for stored activity rows in most deployments. Ensure you can:

- export a user’s historical rows,
- correct or delete on request,
- respond within statutory timelines.

The desktop client keeps a **short-lived local queue** for reliability; it is not a long-term archive.

## International transfers

If EU employees’ metadata is stored outside the EEA, apply Chapter V GDPR tools (adequacy, SCCs, etc.) as you would for any SaaS backend.

## No spyware posture

Spyware is characterized by concealment, excessive permissions, and exfiltration beyond disclosed purpose. This project:

- documents behavior in `README.md` and this file,

and should only be deployed with **explicit organizational authorization** and user notice.
