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

| Method | Path                                      | What                                                                                                                  |
| ------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/inbox/providers`                    | The registered provider plugins: id, name, capabilities, config form                                                  |
| GET    | `/api/inbox/provider-accounts`            | `?organizationId=`: the organization's accounts and the tenant's (never a secret: `secretsSet` names the set ones)    |
| POST   | `/api/inbox/provider-accounts`            | `{ providerId, name, scope?, organizationId?, config, isDefaultOutbound? }`; generated secrets are answered this once |
| GET    | `/api/inbox/provider-accounts/:id`        | One account                                                                                                           |
| PATCH  | `/api/inbox/provider-accounts/:id`        | `{ name?, config?, status? (ACTIVE / DISABLED), isDefaultOutbound? }`; a secret left out or empty keeps its value     |
| POST   | `/api/inbox/provider-accounts/:id/verify` | "Test connection" through the plugin's `verifyAccount`; the result is kept on the account                             |

A tenant-wide account (`scope: TENANT`) also needs `ALL_ORG_EDIT` to be created, changed or tested. Every answer is
`Cache-Control: no-store`.

## Outbound: the transport seam

`InboxEmailTransportResolver` supplies `@gauzy/core`'s `EmailTransportRegistry`, in the order of plan 04 §5.5:

1. the account the sender names (an Inbox reply: the provider account of its mailbox);
2. the organization's default outbound account;
3. the tenant's default outbound account;

then nothing, and `EmailSendService` uses Custom SMTP / `MAIL_*` as before. Disabled accounts, accounts of another tenant
and providers that do not send are never used.

## Tables (migrations for PostgreSQL, MySQL and SQLite)

| Table                    | What                                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `inbox_provider_account` | `providerId`, `name`, `scope` (TENANT, ORGANIZATION), `status` (ACTIVE, ERROR, DISABLED), `isDefaultOutbound`, `config` (public JSON), `configEncrypted` (sealed secrets), `capabilities`, `lastVerifiedAt`, `lastError` |

Idempotent, serialised on PostgreSQL with an advisory lock, reversible.

## Tests

`node --experimental-vm-modules node_modules/jest/bin/jest.js -c packages/plugins/inbox/jest.config.ts --runInBand email`

- The form split (secrets, defaults, generated secrets, refusals), the registry and the secret box.
- On a real SQLite database: the migration (up, up again, down), secrets never answered or stored in the clear, kept on
  update, scope (organization, tenant, other tenant, non-member), the connection test, one default outbound account per
  scope, and the transport order.
