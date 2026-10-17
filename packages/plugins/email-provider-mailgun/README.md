<!-- cspell:ignore DMARC Sscore -->

# @gauzy/plugin-email-provider-mailgun

[Mailgun](https://www.mailgun.com) as an email provider of the Gauzy Inbox: receive with a Mailgun route and send
through the Mailgun Messages API. A copy of the Resend reference plugin (plan 04 §5.2, G-P4-7).

## Switch

**Off by default.** The API lists the plugin only when `EMAIL_PROVIDER_MAILGUN_ENABLED=true` (exactly); any other value
keeps it off and is logged once. It registers with the Inbox email provider registry, so it does something only where
`GAUZY_INBOX_ENABLED=true` and `GAUZY_INBOX_EMAIL_ENABLED=true` too. No table, no route, no migration.

## Set up

1. Add a **Mailgun** provider account (`POST /api/inbox/provider-accounts`) with:
    - the **webhook signing key** (Mailgun → Sending → Webhooks; required, it verifies every inbound POST);
    - an API key with sending access;
    - the sending domain;
    - the region (`us` or `eu`);
    - the default sender.
2. In Mailgun, add a route whose action is `forward("https://<api>/api/inbox/inbound/mailgun/<account id>")`. When
   the URL ends in `mime`, Mailgun posts the raw message instead of the parsed fields; the plugin reads both.
3. Point custom-domain mailboxes at the account. "Test connection" reads `GET /v3/domains/<domain>`, which must be
   `active`.

## How it works

- **Verification.** Every POST carries `timestamp`, `token` and `signature`, which is the HMAC-SHA256 of
  `timestamp + token` under the signing key.
    - A missing or different signature is refused with 401 (constant-time compare), as is a timestamp more than
      15 minutes from now.
    - There is no unsigned mode.
    - The token makes a delivery single use in the Inbox pipeline.
- **Inbound.** A route POST is a form: URL-encoded, or multipart when there are attachments. The Inbox's webhook route
  keeps multipart bodies raw for the plugin. The parsed fields become the Inbox message:
    - `recipient` is the envelope;
    - `message-headers` supplies `Reply-To` and the verdicts;
    - `attachment-N` files become attachments, with `content-id-map` naming the inline ones.

    A raw route (`body-mime`) is parsed as MIME instead. Only the verdicts Mailgun adds are trusted: `X-Mailgun-Spf`,
    `X-Mailgun-Dkim-Check-Result` and `X-Mailgun-Sscore`, taking the first occurrence, since Mailgun prepends its own.
    No DMARC verdict is taken from the message's own headers. In a mailbox with a sender allowlist, an allowlisted
    sender's mail is therefore held in the quarantine until a manager releases it.

- **Outbound.** A nodemailer transport over `POST /v3/<domain>/messages`, authenticated with Basic `api:<key>`. It
  sends:
    - addresses, subject, text and HTML;
    - `h:Message-ID`, `h:In-Reply-To`, `h:References` and `h:Reply-To`;
    - attachments, with inline parts as `inline` named by their content id.

## Tests

`node --experimental-vm-modules node_modules/jest/bin/jest.js -c packages/plugins/email-provider-mailgun/jest.config.ts --runInBand`

The tests cover:

- the switch;
- the signature: accepted, URL-encoded and multipart; unsigned, forged, stale and no-key refused;
- the recorded parsed route POST: addresses, threading, trusted verdicts, attachments and inline parts;
- the raw route;
- a retry-stable derived Message-ID;
- the outbound form;
- the connection test, including the EU region.
