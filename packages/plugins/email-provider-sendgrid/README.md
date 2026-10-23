<!-- cspell:ignore DMARC -->

# @gauzy/plugin-email-provider-sendgrid

[SendGrid](https://sendgrid.com) as an email provider of the Gauzy Inbox. It receives with SendGrid Inbound Parse and
sends through the SendGrid Mail Send API. It is a copy of the Resend reference plugin (plan 04 §5.2, G-P4-7).

## Switch

**Off by default.** The API lists the plugin only when `EMAIL_PROVIDER_SENDGRID_ENABLED=true` (exactly). Any other
value keeps it off and is logged once. The plugin registers with the Inbox email provider registry, so it does
something only where `GAUZY_INBOX_ENABLED=true` and `GAUZY_INBOX_EMAIL_ENABLED=true` too. It adds no table, no route
and no migration.

## Set up

1. In SendGrid, add an Inbound Parse setting for the receiving domain:
    - the destination URL `https://<api>/api/inbox/inbound/sendgrid/<account id>`;
    - a **security policy** with signature verification. Its public key is the account's verification key.

    Either parse mode works: parsed fields, or "POST the raw, full MIME message".

2. Add a **SendGrid** provider account (`POST /api/inbox/provider-accounts`) with:
    - the **verification key** (required; base64 or PEM);
    - an API key with the Mail Send permission;
    - the region (`us`, or `eu` for an EU-pinned subuser);
    - the default sender.
3. Point custom-domain mailboxes at the account. "Test connection" reads `GET /v3/scopes`, which must include
   `mail.send`.

## How it works

- **Verification.** Every POST carries an ECDSA (P-256, SHA-256) signature over `<timestamp><raw body>`. The signature
  is in `X-Twilio-Email-Event-Webhook-Signature` and the timestamp in `X-Twilio-Email-Event-Webhook-Timestamp`. Both
  are checked against the verification key:
    - a missing or wrong signature is refused with 401, and so is a timestamp more than 15 minutes from now;
    - there is no unsigned mode;
    - the signature makes a delivery single use in the Inbox pipeline.
- **Inbound.** The POST is a multipart form, which the Inbox's webhook route keeps raw for the plugin. The parsed
  fields become the Inbox message:
    - `envelope` gives the envelope;
    - `headers` (the raw header block) gives the threading headers;
    - `attachmentN` files become attachments, with `attachment-info` and `content-ids` naming them and marking inline
      parts.

    A raw-mode POST (`email`) is parsed as MIME instead.

    Only SendGrid's own checks are trusted: the `SPF` and `dkim` fields and `spam_score`. No DMARC verdict is
    reported, so in a mailbox with a sender allowlist, mail from an allowlisted sender is held in the quarantine until
    a manager releases it.

- **Outbound.** A nodemailer transport over `POST /v3/mail/send` with a Bearer key. It carries:
    - the personalizations (to, cc and bcc);
    - from and reply-to;
    - text/plain first, then text/html;
    - the `Message-ID`, `In-Reply-To` and `References` headers;
    - attachments, with inline parts by `content_id`.

    The message id is SendGrid's `X-Message-Id`.

## Tests

`node --experimental-vm-modules node_modules/jest/bin/jest.js -c packages/plugins/email-provider-sendgrid/jest.config.ts --runInBand`

The tests cover:

- the switch;
- the signature: a key pair made per run; accepted; an unsigned request, another key, a changed body, a stale
  timestamp and a missing key all refused;
- the recorded parsed POST: addresses, folded threading headers, trusted checks, attachments and inline parts;
- the raw mode;
- the outbound request;
- the connection test, including the EU region.
