<!-- cspell:ignore DMARC -->

# @gauzy/plugin-email-provider-postmark

[Postmark](https://postmarkapp.com) as an email provider of the Gauzy Inbox: receive with a Postmark inbound stream and
send through the Postmark API. A copy of the Resend reference plugin (plan 04 §5.2, G-P4-7).

## Switch

**Off by default.** The API lists the plugin only when `EMAIL_PROVIDER_POSTMARK_ENABLED=true` (exactly); any other
value keeps it off and is logged once. It registers with the Inbox email provider registry, so it does something only
where `GAUZY_INBOX_ENABLED=true` and `GAUZY_INBOX_EMAIL_ENABLED=true` too. No table, no route, no migration.

## Set up

1. Add a **Postmark** provider account (`POST /api/inbox/provider-accounts`): the server API token and the default
   sender. The server generates the webhook's Basic-auth credential and answers it **once**, inside
   `oneTimeWebhookUrl` (`https://<user>:<password>@…/api/inbox/inbound/postmark/<account id>`).
2. Paste that URL as the inbound webhook of the server's inbound stream (Postmark sends the credential as
   `Authorization: Basic`). Rotate it by clearing `webhookPassword` with `null` (a new URL is answered once).
3. Point custom-domain mailboxes at the account; "Test connection" reads `GET /server`.

## How it works

- **Verification.** Postmark does not sign webhooks, so the per-account Basic-auth credential is required: missing or
  different = 401 (constant-time compare). There is no unsigned mode. The Postmark message id makes a delivery single
  use in the Inbox pipeline. Serve the API over HTTPS: the credential travels in the request.
- **Inbound.** The JSON fields (or `RawEmail`, parsed as MIME, when the stream includes it) become the Inbox message;
  `OriginalRecipient` is the envelope. Only verdicts Postmark adds are trusted (`Received-SPF`, `X-Spam-Score`); no
  DKIM / DMARC verdict is taken from the message's own headers, so in a mailbox with a sender allowlist the mail of an
  allowlisted sender is held in the quarantine until a manager releases it.
- **Outbound.** A nodemailer transport over `POST /email` (`X-Postmark-Server-Token`): addresses, subject, text,
  HTML, attachments, `Message-ID` / `In-Reply-To` / `References` headers, the message stream.

## Tests

`node --experimental-vm-modules node_modules/jest/bin/jest.js -c packages/plugins/email-provider-postmark/jest.config.ts --runInBand`

The switch; the credential (accepted; unsigned, wrong and missing refused); the webhook URL; the recorded inbound JSON
(addresses, threading, verdicts, attachments) and `RawEmail`; the outbound request; the connection test.
