<!-- cspell:ignore dmarc softfail -->

# Inbox email (`@gauzy/plugin-inbox`, Phase 4)

Mailboxes, inbound email and the email provider plugins of the Gauzy Inbox. Plan: `ever-co/homelab`
`docs/superpowers/specs/2026-10-15-gauzy-ever-works-integration/04-inbox-and-email.md` §5 (G-P4-1 … G-P4-7).

## Switch

**Off by default.** The API lists `InboxEmailPlugin` only when `GAUZY_INBOX_ENABLED=true` **and**
`GAUZY_INBOX_EMAIL_ENABLED=true` (exactly), after `InboxPlugin`. When it is off nothing of it is loaded: no route, no
table (its migrations are not registered), no transport. Every email then goes out over SMTP (the organization's Custom
SMTP, the tenant's, then `MAIL_*`) exactly as before. Any other value also keeps it off, and is logged once.

Provider credentials are stored encrypted with `ENCRYPTION_KEY` (a base64-encoded 32-byte key). Without one, a key
derived from a non-default `JWT_SECRET` is used; with neither, no account can be added.

## Provider plugins

Every provider is a plugin that registers an `IEmailProviderPlugin` with the `EmailProviderRegistry` at bootstrap,
through the `INBOX_EMAIL_PROVIDER_REGISTRY` token (`@gauzy/contracts`). The token is absent when the Inbox email features
are off, so inject it optionally:

```ts
constructor(@Optional() @Inject(INBOX_EMAIL_PROVIDER_REGISTRY) private readonly registry?: IEmailProviderRegistry) {}

onModuleInit() {
	this.registry?.register({
		id: 'resend',
		displayName: 'Resend',
		capabilities: { inbound: true, outbound: true, customDomains: true },
		configSchema: { type: 'object', properties: { apiKey: { type: 'string', writeOnly: true } }, required: ['apiKey'] },
		inbound: { verify: async (request, account) => …, parse: async (request, account) => [ … ] },
		createTransport: (account) => resendTransport(account.config),
		verifyAccount: async (account) => ({ ok: true })
	});
}
```

- `configSchema` is the account form of Settings → Inbox → Providers: no provider needs a UI package. `writeOnly` fields
  are secrets (sealed, never answered); a `generated` secret is created by the server when it is left empty and shown
  once, in the answer that created the account.
- `inbound.verify` throws when a request is not proven to come from the provider for that account (401). There is no
  "accept unsigned" mode.
- `createTransport` answers a nodemailer transport (a custom transport `{ name, version, send(mail, callback) }`). The
  Inbox registers it with the core transport seam (`EmailTransportRegistry`, `@gauzy/core`).

## Provider accounts (`INBOX_MAILBOX_MANAGE`, members of the organization)

| Method | Path                                      | What                                                                                                                                                                            |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/inbox/providers`                    | The registered provider plugins: id, name, capabilities, config form                                                                                                            |
| GET    | `/api/inbox/provider-accounts`            | `?organizationId=`: the organization's accounts and the tenant's (never a secret: `secretsSet` names the set ones)                                                              |
| POST   | `/api/inbox/provider-accounts`            | `{ providerId, name, scope?, organizationId?, config, isDefaultOutbound? }`; generated secrets are answered this once                                                           |
| GET    | `/api/inbox/provider-accounts/:id`        | One account                                                                                                                                                                     |
| PATCH  | `/api/inbox/provider-accounts/:id`        | `{ name?, config?, status? (ACTIVE / DISABLED), isDefaultOutbound? }`; a secret left out or empty keeps its value; a generated secret sent as `null` is rotated (answered once) |
| POST   | `/api/inbox/provider-accounts/:id/verify` | "Test connection" through the plugin's `verifyAccount`; the result is kept on the account                                                                                       |

A tenant-wide account (`scope: TENANT`) also needs `ALL_ORG_EDIT` to be created, changed or tested. Every answer is
`Cache-Control: no-store`. Configuration changes are merged under a row lock; one default outbound account per scope is
kept by a per-scope lock and, on PostgreSQL and SQLite, partial unique indexes (a lost race answers 409). A connection test
never re-enables an account that was disabled meanwhile.

## Outbound: the transport seam

`InboxEmailTransportResolver` supplies `@gauzy/core`'s `EmailTransportRegistry`, in the order of plan 04 §5.5:

1. the account the sender names (an Inbox reply: the provider account of its mailbox);
2. the organization's default outbound account;
3. the tenant's default outbound account;

then nothing, and `EmailSendService` uses Custom SMTP / `MAIL_*` as before. Disabled accounts, accounts of another tenant
and providers that do not send are never used.

## Mailboxes (`/api/inbox/mailboxes`)

The addresses an organization receives mail at (plan 04 §5.1, G-P4-1). An address is lower-case and unique across the
deployment, and one namespace with the Docs capture addresses (each side checks the other through the
`INBOUND_ADDRESS_NAMESPACE` token, and both check and save under the address's claim: a lock per address, across the
replicas, so two requests for one address never both succeed).

- **Platform addresses** on `GAUZY_INBOX_DOMAIN` (one domain for every tenant; each environment its own), the
  organization in the local part: `<first>.<last>.<orgSlug>` for an employee, `<name>.<orgSlug>` for the organization
  (several), `<team>.<orgSlug>` for a team. A collision gets a numeric suffix on the name; a chosen name that is taken is
  refused. They receive through the platform route.
- **Custom domains**: any `x@acme.com`, received through a provider account of the organization (or the tenant), once
  the domain is proven by a DNS TXT record at `_gauzy-inbox.<domain>` (`POST /:id/verify`; a verified domain whose record
  disappears fails). Each mailbox has its own value (several TXT values can sit at that name), and a check changes only
  that mailbox. The platform's own domains are reserved.
- **Forwarding**: a platform address the user forwards an existing mailbox to; no DNS change (`forwardFrom` is kept for
  the instructions).
- **Auto-provisioning** (opt-in per organization, `PUT /settings`): a mailbox for every new employee; and
  `POST /provision` creates the missing employee mailboxes and the default organization mailbox (`inbox.<orgSlug>`) now.
  Agent employees never get one. The check and the creation run under the organization's lock, so overlapping runs
  (the employee hook, a manual run, another replica) never create a mailbox twice.
- **Members** of organization and team mailboxes (`PUT /:id/members`, READER or MANAGER; users of the organization only).
  With no members, a team mailbox reaches the team's members, an organization mailbox the users whose role grants
  `INBOX_MAILBOX_MANAGE`. `GET /mine` lists exactly the mailboxes whose mail the caller receives by these rules. A
  default mailbox is one per owner (the organization, each team, each employee).
- **Relay secret** (`POST /:id/rotate-secret`): answered once, stored as a scrypt digest.

| Method      | Path                                     | Who                    |
| ----------- | ---------------------------------------- | ---------------------- |
| GET         | `/api/inbox/mailboxes/mine`              | `INBOX_VIEW`           |
| GET / POST  | `/api/inbox/mailboxes`                   | `INBOX_MAILBOX_MANAGE` |
| GET / PATCH | `/api/inbox/mailboxes/:id`               | `INBOX_MAILBOX_MANAGE` |
| POST        | `/api/inbox/mailboxes/:id/verify`        | `INBOX_MAILBOX_MANAGE` |
| POST        | `/api/inbox/mailboxes/:id/rotate-secret` | `INBOX_MAILBOX_MANAGE` |
| GET / PUT   | `/api/inbox/mailboxes/:id/members`       | `INBOX_MAILBOX_MANAGE` |
| POST        | `/api/inbox/mailboxes/provision`         | `INBOX_MAILBOX_MANAGE` |
| GET / PUT   | `/api/inbox/mailboxes/settings`          | `INBOX_MAILBOX_MANAGE` |

Management also needs an active membership of the organization; the tenant is always the caller's.

## Inbound: the provider webhook and the worker

`POST /api/inbox/inbound/:providerId/:accountId` is `@Public()`: the provider account's own secret proves each request
(`provider.inbound.verify`; there is no unsigned mode), with a per-client-address rate limit
(`GAUZY_INBOX_INBOUND_REQUESTS_PER_MINUTE`, default 600). The platform route `/api/inbox/inbound/generic/platform` is
proven with `GAUZY_INBOX_PLATFORM_SECRET` (at least 24 characters; unset, the route answers 404); the Cloudflare Email
Worker of the platform domain (`GAUZY_INBOX_DOMAIN`) posts there. JSON and URL-encoded bodies arrive parsed with their
raw bytes; a `multipart/form-data` body (a form with files: Mailgun, SendGrid) or a `text/plain` one (SNS) is kept raw
by the route itself (`InboundRawBodyMiddleware`, up to twice `GAUZY_INBOX_MAX_MESSAGE_BYTES` plus 1 MB; 413 beyond),
and providers read forms with `readInboundForm`.

1. Unknown provider or account (or a disabled one): 404. Unproven: 401. Over `GAUZY_INBOX_MAX_MESSAGE_BYTES`: 413.
2. Per message, only the envelope recipients (else `To` / `Cc`) that are active mailboxes **of this account** count: a
   mailbox receives only through the account it points at (the platform route: mailboxes without an account), in the
   account's tenant and, for an organization's account, organization; a custom-domain mailbox only once its domain is
   verified; and only from senders its allowlist admits. The `From` header alone is forgeable: an allowlisted sender
   without a DMARC `pass` from the provider (a relay that reports no verdict, or a failed one) is stored but **held in
   the quarantine** (`x-gauzy-inbox-hold: unverified-sender`) until a manager releases it. The mailbox row decides the
   tenant, never the payload. Everything else is dropped. A `+tag` is kept in the message's headers.
3. The raw message is stored (`.eml`, or the normalized `.json` when the provider delivers no MIME; FileStorage, or with
   local storage a private directory, `GAUZY_INBOX_LOCAL_STORAGE_PATH`, never the public asset root), and
   one `inbox_email` row per mailbox (`RECEIVED`; unique on `(mailboxId, messageId)`, so a retry is a duplicate).
   Email files always use the deployment's storage settings (`FILE_PROVIDER`, `AWS_*` and co.), never a tenant's own
   storage overrides, so the webhook, the worker and a signed-in download read and write the same place.
4. The answer is 202 `{ accepted, duplicates, dropped }`, and the rows go to the worker.

The **worker** runs in the API process (a background task right after the webhook, plus a sweep every two minutes for a
message whose hand-over was lost; `GAUZY_INBOX_EMAIL_WORKER=off` keeps a process out). Each message is claimed with a
conditional update, so replicas never process one twice. It parses the stored message again, **sanitizes the HTML on the
server** (`sanitize-html`: no scripts, handlers, forms, frames, `svg`, style sheets; links open without a referrer;
remote images are blocked into `data-remote-src`), stores the attachments (SHA-256, at most 100; active content such as
HTML or SVG is never offered as what it claims; their rows are written with the claimed state in one transaction, so a
worker another replica took over changes nothing), threads the message (`In-Reply-To` / `References`, else the normalized subject with a
shared participant within 30 days), decides the spam verdict (authentication failures and the provider's score against
`GAUZY_INBOX_SPAM_SUSPECT_SCORE` / `GAUZY_INBOX_SPAM_QUARANTINE_SCORE`), and creates the `EMAIL` inbox item
(`source = EMAIL`, linked to the mailbox and the message) for the mailbox's recipients: the employee's user, or the
members of a shared mailbox (with none: a team's members, or the organization's users whose role grants
`INBOX_MAILBOX_MANAGE`), counting only users who are still active members of the mailbox's organization. A quarantined
message gets no item until a manager releases it. A failure is retried three times, then left `FAILED` with its error.

## Messages (`/api/inbox/emails`, `INBOX_VIEW` plus access to the mailbox)

| Method | Path                                      | What                                                                                           |
| ------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| GET    | `/api/inbox/emails/:id`                   | The message: sanitized HTML, text, addresses, verdicts, attachment metadata                    |
| GET    | `/api/inbox/emails/:id/thread`            | The thread's messages, oldest first                                                            |
| GET    | `/api/inbox/emails/:id/raw`               | The raw source (mailbox managers): always a download                                           |
| GET    | `/api/inbox/emails/:id/attachments/:aid`  | An attachment: always a download, `nosniff`, `sandbox` CSP                                     |
| POST   | `/api/inbox/emails/:id/reply`             | `{ text, replyAll?, cc? }`: from the mailbox's address, `In-Reply-To` / `References`, threaded |
| POST   | `/api/inbox/emails/:id/forward`           | `{ to, text?, includeAttachments? }`                                                           |
| GET    | `/api/inbox/emails/quarantine?mailboxId=` | The mailbox's quarantine (managers)                                                            |
| POST   | `/api/inbox/emails/:id/release`           | Release a quarantined message into the recipients' inboxes (managers)                          |

A message is readable by its inbox item's recipients, the mailbox's recipients, and holders of `INBOX_MAILBOX_READ_ALL`
in the tenant. Replies and forwards send as the mailbox, so they need current access to it (a former member still reads
what was addressed to them). A reply to a sent message follows up with its recipients. A forward carries every stored
attachment. Replies and forwards go out through the core transport seam with the mailbox's provider account first
(then the organization's and the tenant's default outbound accounts, then Custom SMTP / `MAIL_*`), and are kept as `OUT`
messages of the thread (`SENT`, or `FAILED` with the error).

## Tables (migrations for PostgreSQL, MySQL and SQLite)

| Table                        | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `inbox_provider_account`     | `providerId`, `name`, `scope` (TENANT, ORGANIZATION), `status` (ACTIVE, ERROR, DISABLED), `isDefaultOutbound`, `config` (public JSON), `configEncrypted` (sealed secrets), `capabilities`, `lastVerifiedAt`, `lastError`                                                                                                                                                                                                                                                                                           |
| `inbox_mailbox`              | `address` (lower-case, unique across the deployment), `displayName`, `kind` (PLATFORM, CUSTOM_DOMAIN, FORWARDING, CONNECTED), `ownerType` (EMPLOYEE, ORGANIZATION, TEAM), `ownerEmployeeId` / `ownerTeamId`, `purpose`, `providerAccountId` (null: the platform route), `inboundSecretHash`, `senderAllowlist`, `domain` / `domainStatus` / `domainVerificationToken`, `isDefault`, `autoProvisioned`, `lastMessageAt`, `messageCount`, `settings`                                                                 |
| `inbox_mailbox_member`       | `mailboxId`, `userId` (unique together), `role` (READER, MANAGER)                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `inbox_email_thread`         | `mailboxId`, `subjectNormalized`, `participants`, `lastMessageAt`, `messageCount`                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `inbox_email`                | `mailboxId`, `threadId`, `direction`, `messageId` (unique per mailbox), `inReplyTo`, `referenceIds`, `sender` / `toAddresses` / `ccAddresses` / `bccAddresses` / `replyToAddresses` (JSON), `subject`, `textBody`, `htmlSanitized`, `snippet`, `headers` (allowlisted), `spf` / `dkim` / `dmarc`, `spamScore`, `spamVerdict`, `receivedAt`, `sentAt`, `sizeBytes`, `rawStorageKey` / `rawStorageProvider`, `status`, `providerAccountId`, `providerMessageId`, `transport`, `error`, `attemptCount`, `inboxItemId` |
| `inbox_email_attachment`     | `emailId`, `filename`, `contentType`, `size`, `sha256`, `storageKey` / `storageProvider`, `contentId`, `isInline`, `savedDocumentId`                                                                                                                                                                                                                                                                                                                                                                               |
| `inbox_organization_setting` | `autoProvisionEmployees` (one row per organization)                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

Idempotent, serialised on PostgreSQL with an advisory lock, reversible.

## Tests

`node --experimental-vm-modules node_modules/jest/bin/jest.js -c packages/plugins/inbox/jest.config.ts --runInBand email`

- The form split (secrets, defaults, generated secrets, refusals), the registry and the secret box.
- Addresses and subjects, MIME parsing, HTML sanitizing, the generic signed webhook (signature, window, single use, raw
  and structured bodies).
- The pipeline on a real SQLite database: the webhook's mailbox rules and idempotency, the worker (sanitize, attachments,
  threading, quarantine and release, retries, the sweep, the EMAIL item through `InboxService`), and the message API
  (read access, raw, reply and forward through the transport seam).
- On a real SQLite database: the migration (up, up again, down), secrets never answered or stored in the clear, kept on
  update, scope (organization, tenant, other tenant, non-member), the connection test, one default outbound account per
  scope, and the transport order.
