<!-- cspell:ignore authserv -->

# Gauzy Inbox — Cloudflare Email Worker

This is the platform default receiver of the Gauzy Inbox (plan 04 §5.2, G-P4-3). Cloudflare Email Routing receives
all mail for the platform mailbox domain (`GAUZY_INBOX_DOMAIN`, one domain per environment). This Worker then posts
each message to the Gauzy API's generic inbound route, signed with the platform secret. The API matches the
recipients to mailboxes, stores the message and files it in the recipients' Inbox.

**This directory is code only.** Deploying it means changing DNS (MX records), Email Routing and a Worker. Those are
live changes: claim them in `MAINTENANCE.md` and get the owner's OK first.

## What it does

| Step       | Behaviour                                                                                                                                                                                                                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Size       | A message over `GAUZY_INBOX_MAX_MESSAGE_BYTES` (default 25 MB, the API's default) is rejected before it is read.                                                                                                                                                                                                                   |
| Verdicts   | Cloudflare checks SPF, DKIM and DMARC. Only the topmost `Authentication-Results` (else the first `ARC-Authentication-Results`) whose authserv-id is `GAUZY_INBOX_TRUSTED_AUTHSERV_ID` (default `mx.cloudflare.net`) is forwarded. A sender's own header never is, so mailbox sender allowlists rely on Cloudflare's DMARC verdict. |
| Post       | `POST <GAUZY_INBOX_API_URL>/api/inbox/inbound/generic/platform` with `{ "raw": "<base64>", "envelope": { "from", "to": [rcpt] }, "authenticationResults"? }` and `X-Gauzy-Inbox-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<body>">`. This is the scheme the API's generic provider verifies (5-minute window, single use).   |
| No mailbox | When the API accepted nothing and nothing was a duplicate, the message is rejected, so the sender gets a bounce.                                                                                                                                                                                                                   |
| Refusals   | 413, and any other 4xx except those listed in the next row, reject the message.                                                                                                                                                                                                                                                    |
| Retries    | A network error, a 5xx, a 429, or a 401 / 404 throws. 401 and 404 mean the platform route is shut or the secret differs: a configuration problem on our side. The sending server keeps the message and retries, so nothing is lost while it is fixed.                                                                              |

The Worker has no dependencies. It uses the Workers runtime's Web Crypto, `fetch` and `Response`.

## Deploy (one Worker per environment)

These steps are live changes; claim them first.

1. On the API, set `GAUZY_INBOX_ENABLED=true`, `GAUZY_INBOX_EMAIL_ENABLED=true`, `GAUZY_INBOX_DOMAIN=<the domain>`
   and `GAUZY_INBOX_PLATFORM_SECRET=<random, at least 24 characters>`. Until the secret is set, the platform route
   answers 404.
2. Copy `wrangler.toml.example` to `wrangler.toml`. Set `name` (per environment) and `GAUZY_INBOX_API_URL`, then run
   `wrangler secret put GAUZY_INBOX_PLATFORM_SECRET` with the same value as the API, and `wrangler deploy`.
3. In the Cloudflare zone of the domain:
    - enable **Email Routing**, which adds its MX and SPF records;
    - add a **catch-all** rule with the action "Send to a Worker" pointing at this Worker.
4. Send a message to a mailbox address (for example one from `GET /api/inbox/mailboxes/mine`) and check it arrives.
   Also send one to an unknown address and check it bounces.

To rotate the secret, change it on the API and the Worker together. Messages refused in between are retried by their
senders.

## Tests

`node --test .deploy/cloudflare/inbox-email-worker/test` (Node 20+).

The tests cover:

- the signed body, checked with the API's scheme;
- trusted and forged verdicts;
- oversize and unknown-recipient rejects;
- refusals versus retries;
- the settings check.
