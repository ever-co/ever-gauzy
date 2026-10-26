<!-- cspell:ignore DMARC SESv2 -->

# @gauzy/plugin-email-provider-ses

[Amazon SES](https://aws.amazon.com/ses/) as an email provider of the Gauzy Inbox. It receives with an SES receipt rule
and sends through the SESv2 API. It is a copy of the Resend reference plugin (plan 04 §5.2, G-P4-7) and has no AWS
SDK dependency: requests are signed with SigV4 by the plugin itself.

## Switch

**Off by default.** The API lists the plugin only when `EMAIL_PROVIDER_SES_ENABLED=true` (exactly). Any other value
keeps it off and is logged once. The plugin registers with the Inbox email provider registry, so it does something
only where `GAUZY_INBOX_ENABLED=true` and `GAUZY_INBOX_EMAIL_ENABLED=true` too. It adds no table, no route and no
migration.

## Set up

1. Create an SNS topic, and an **HTTPS subscription** to `https://<api>/api/inbox/inbound/ses/<account id>`. The
   plugin confirms the subscription itself once its signature verifies.
2. Create an SES receipt rule for the receiving domain with one of:
    - an **SNS action** to that topic, with Base64 or UTF-8 encoding (messages up to 150 KB);
    - an **S3 action** to a bucket, notifying that topic (any size).
3. Add an **Amazon SES** provider account (`POST /api/inbox/provider-accounts`) with:
    - the topic ARN and the region (both required);
    - an IAM access key with `ses:SendEmail` and, for S3, `s3:GetObject` on the bucket;
    - the bucket name (S3 actions only);
    - the default sender.
4. Point custom-domain mailboxes at the account. "Test connection" calls SESv2 `GetAccount`, which also reports the
   sandbox.

## How it works

- **Verification.** Every SNS POST is checked:
    - the topic must be the account's;
    - the signature (SignatureVersion 1 / SHA1 or 2 / SHA256) must verify under the signing certificate, which is
      fetched only from `https://sns.<region>.amazonaws.com/….pem` and cached;
    - the timestamp must be within a day (SNS retries keep the original one).

    Anything else is refused with 401. There is no unsigned mode. The SNS message id makes a delivery single use in
    the Inbox pipeline.

- **Inbound.** SNS posts `text/plain` JSON, which the Inbox's webhook route keeps raw for the plugin. A "Received"
  notification carries the raw message (SNS action), or names the S3 object (S3 action). For an S3 action, the
  message is fetched with SigV4, only from the account's bucket and capped at `GAUZY_INBOX_MAX_MESSAGE_BYTES`. The
  message is then parsed as MIME:
    - `receipt.recipients` give the envelope;
    - SES's own SPF, DKIM and **DMARC** verdicts are trusted, so a sender allowlist works with SES;
    - a FAIL spam verdict scores the message as spam; a FAIL virus verdict holds it in the quarantine whatever
      `GAUZY_INBOX_SPAM_QUARANTINE_SCORE` is.
- **Outbound.** A nodemailer transport sends the raw message (Bcc only in the envelope) through
  `POST /v2/email/outbound-emails`. The message id comes from SES.

## Tests

`node --experimental-vm-modules node_modules/jest/bin/jest.js -c packages/plugins/email-provider-ses/jest.config.ts --runInBand`

The tests cover:

- the switch;
- SigV4, against the AWS test suite's vectors;
- the SNS signature, with a key made per run:
    - accepted with version 2 and version 1;
    - unsigned, forged, changed, another topic, stale, a certificate off SNS and an empty body all refused;
- the recorded "Received" notification: verdicts including DMARC, the envelope;
- the virus hold and the spam score;
- the S3 fetch: SigV4, and another bucket refused;
- the subscription confirmation: on SNS only;
- the raw outbound request;
- the connection test: ready, sandbox, refused.
