<!-- cspell:ignore svix whsec -->

# @gauzy/plugin-email-provider-resend

[Resend](https://resend.com) as an email provider of the Gauzy Inbox: receive mail with Resend inbound and send through
the Resend API. The reference provider plugin (plan 04 §5.2, G-P4-4) that the Postmark, Mailgun, SendGrid and Amazon SES
plugins copy.

Plan: `ever-co/homelab` `docs/superpowers/specs/2026-10-15-gauzy-ever-works-integration/04-inbox-and-email.md` §5.2.

## Switch

**Off by default.** The API lists the plugin only when `EMAIL_PROVIDER_RESEND_ENABLED=true` (exactly); any other value
keeps it off and is logged once. It registers with the Inbox email provider registry, so it does something only where
`GAUZY_INBOX_ENABLED=true` and `GAUZY_INBOX_EMAIL_ENABLED=true` too. It owns no table, no route and no migration.

## Set up

1. In Settings → Inbox → Providers (`POST /api/inbox/provider-accounts`), add a **Resend** account: the API key
   (`re_…`; a full-access key for receiving and the connection test), and the default sender on a domain verified at
   Resend. Secrets are stored encrypted and never answered.
2. In Resend, add a webhook for `email.received` to the account's URL (`webhookUrl` in the account), for example
   `https://api.example.com/api/inbox/inbound/resend/<account id>`, and paste its signing secret (`whsec_…`) into the
   account.
3. Point mailboxes (custom-domain mailboxes on a domain that receives at Resend) at the account.
4. "Test connection" (`POST /api/inbox/provider-accounts/:id/verify`) lists the verified domains.

To send the organization's or the tenant's mail through Resend, make the account the default outbound account
(`isDefaultOutbound`). Inbox replies from a mailbox go through the mailbox's account.

## How it works

| Part         | What                                                                                                                                                                                                                                                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verification | Svix headers `svix-id`, `svix-timestamp`, `svix-signature` (`v1,<base64>`, several during a rotation): HMAC-SHA256 under the `whsec_` key over `<id>.<timestamp>.<raw body>`, 5-minute window, constant-time compare, single use per `svix-id` (Redis `SET NX` when Redis is on). No secret, no signature, a stale or reused one: 401. No unsigned mode.   |
| Inbound      | `email.received` carries metadata only: the plugin fetches `GET /emails/receiving/:id` and `…/attachments` (short-lived signed URLs, size-capped, SSRF-checked, no redirects) with the account's key; a raw message, when Resend offers one, is parsed as MIME instead. Other event types are ignored. The Inbox sanitizes, threads and files the message. |
| Outbound     | A nodemailer transport over `POST /emails` for the core transport seam: addresses, subject, text, HTML, attachments, `In-Reply-To` / `References` as headers; nodemailer's `Message-ID` is the idempotency key.                                                                                                                                            |
| Test         | `GET /domains`: the verified domains; a refused key fails; a sending-only key is reported as valid but restricted.                                                                                                                                                                                                                                         |

## Tests

`node --experimental-vm-modules node_modules/jest/bin/jest.js -c packages/plugins/email-provider-resend/jest.config.ts --runInBand`

The switch; the Svix signature (accepted once; unsigned, forged, stale, changed body and a missing secret refused;
rotation); parsing of recorded Resend payloads (webhook → Receiving API → attachments; other events ignored; a download
URL to a private address refused); the outbound request; the connection test.
