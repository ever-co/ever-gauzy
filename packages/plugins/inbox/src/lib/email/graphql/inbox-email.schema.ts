import { gql } from 'graphql-tag';

/**
 * The Inbox email features' contribution to the one GraphQL schema: the GraphQL twins of the management routes
 * (`/api/inbox/providers`, `/api/inbox/provider-accounts*`). It is registered only with `InboxEmailPlugin`, so a
 * deployment without `GAUZY_INBOX_ENABLED=true` and `GAUZY_INBOX_EMAIL_ENABLED=true` serves none of it (and the
 * committed schema snapshot, composed from the default plugin list, does not carry it). The field-binding gate reads
 * this document on top of the snapshot — it is named in `GATED_PLUGIN_SCHEMAS` of
 * `tools/scripts/graphql-field-binding-check.mjs` — so it must stay a plain `gql` template (no `${…}`), registered
 * by `InboxEmailPlugin` as `schema: inboxEmailSchemaExtensions`.
 *
 * Every field reaches the service method its REST route reaches, with the route's DTO rules, guards and permission.
 * Secrets are write-only exactly as over REST: an account answers which secret fields are set (`secretsSet`), never
 * their values; a secret the server generates is answered once, by the mutation that generated it. Enumerated values
 * (`scope`, `status`) are strings holding the REST values, so a new value is an additive change.
 */
export const inboxEmailSchemaExtensions = gql`
	"What an email provider plugin can do."
	type InboxEmailProviderCapabilities {
		"Receives mail (a webhook, or a fetch the webhook triggers)."
		inbound: Boolean!
		"Sends mail through its API (the transport seam)."
		outbound: Boolean!
		"Receives for an organization's own domain."
		customDomains: Boolean!
		"Reads an existing mailbox (IMAP, Gmail, Microsoft 365)."
		connectedMailbox: Boolean
	}

	"A registered email provider plugin, with its account form (GET /inbox/providers)."
	type InboxEmailProvider {
		"resend, postmark, mailgun, sendgrid, ses, generic, …"
		id: String!
		displayName: String!
		description: String
		capabilities: InboxEmailProviderCapabilities!
		"The account form (a JSON Schema subset: an object type, its properties, required); writeOnly fields are secrets."
		configSchema: JSON!
	}

	"An email provider account of the organization or of the tenant. Never a secret: secretsSet names the set ones."
	type InboxProviderAccount {
		id: ID!
		tenantId: ID
		organizationId: ID
		createdAt: DateTime
		updatedAt: DateTime
		providerId: String!
		name: String!
		"TENANT or ORGANIZATION."
		scope: String!
		"ACTIVE, ERROR (the last connection test failed) or DISABLED."
		status: String!
		"The account the scope's outbound mail goes through."
		isDefaultOutbound: Boolean!
		"The configuration's non-secret fields."
		config: JSON!
		"The secret fields that have a value."
		secretsSet: [String!]!
		capabilities: InboxEmailProviderCapabilities
		lastVerifiedAt: DateTime
		lastError: String
		"The URL to paste into the provider (null without inbound, or when it carries a credential)."
		webhookUrl: String
	}

	"An account just created or changed, with the secrets the server generated for it: answered this once only."
	type InboxProviderAccountSaved {
		id: ID!
		tenantId: ID
		organizationId: ID
		createdAt: DateTime
		updatedAt: DateTime
		providerId: String!
		name: String!
		"TENANT or ORGANIZATION."
		scope: String!
		"ACTIVE, ERROR or DISABLED."
		status: String!
		isDefaultOutbound: Boolean!
		config: JSON!
		secretsSet: [String!]!
		capabilities: InboxEmailProviderCapabilities
		lastVerifiedAt: DateTime
		lastError: String
		webhookUrl: String
		"The secrets the server generated, by field (an empty object when none): shown this once."
		oneTimeSecrets: JSON!
		"The webhook URL carrying a generated credential, shown this once (null when the URL carries none)."
		oneTimeWebhookUrl: String
	}

	"A removed account (kept as deleted and disabled)."
	type InboxProviderAccountRemoved {
		id: ID!
		deleted: Boolean!
	}

	"The result of a connection test, kept on the account."
	type InboxProviderAccountCheck {
		ok: Boolean!
		"Human-readable, never a secret."
		message: String
		checkedAt: DateTime!
		details: JSON
	}

	"A new provider account (the body of POST /inbox/provider-accounts)."
	input CreateInboxProviderAccountInput {
		"A registered provider plugin's id (lower case, at most 32 characters)."
		providerId: String!
		"At most 120 characters."
		name: String!
		"TENANT or ORGANIZATION (default ORGANIZATION); a tenant-wide account also needs ALL_ORG_EDIT."
		scope: String
		"The organization (default: the request's selected organization); the caller must be a member."
		organizationId: ID
		"The provider form's values, checked against its configSchema; secret fields are stored encrypted."
		config: JSON
		isDefaultOutbound: Boolean
	}

	"A change of a provider account (the body of PATCH /inbox/provider-accounts/:id)."
	input UpdateInboxProviderAccountInput {
		"At most 120 characters."
		name: String
		"Merged with the stored form: a secret left out or empty keeps its value; a generated secret sent as null is rotated."
		config: JSON
		"ACTIVE or DISABLED."
		status: String
		"true makes it the scope's outbound account (the previous one stops being it)."
		isDefaultOutbound: Boolean
	}

	extend type Query {
		"The email provider plugins of this server, with their capabilities and forms (GET /inbox/providers; INBOX_MAILBOX_MANAGE)."
		inboxEmailProviders: [InboxEmailProvider!]!
		"The organization's and the tenant's provider accounts (GET /inbox/provider-accounts; INBOX_MAILBOX_MANAGE)."
		inboxProviderAccounts(organizationId: ID): [InboxProviderAccount!]!
		"One provider account (GET /inbox/provider-accounts/:id; INBOX_MAILBOX_MANAGE)."
		inboxProviderAccount(id: ID!, organizationId: ID): InboxProviderAccount
	}

	extend type Mutation {
		"Add a provider account; secrets the server generates are answered this once (POST /inbox/provider-accounts; INBOX_MAILBOX_MANAGE)."
		createInboxProviderAccount(input: CreateInboxProviderAccountInput!): InboxProviderAccountSaved!
		"Rename, reconfigure, disable or make an account the outbound default (PATCH /inbox/provider-accounts/:id; INBOX_MAILBOX_MANAGE)."
		updateInboxProviderAccount(
			id: ID!
			input: UpdateInboxProviderAccountInput!
			organizationId: ID
		): InboxProviderAccountSaved!
		"Remove an account; refused while a mailbox receives through it (DELETE /inbox/provider-accounts/:id; INBOX_MAILBOX_MANAGE)."
		deleteInboxProviderAccount(id: ID!, organizationId: ID): InboxProviderAccountRemoved!
		"Test connection: the provider checks the account's credentials (POST /inbox/provider-accounts/:id/verify; INBOX_MAILBOX_MANAGE)."
		verifyInboxProviderAccount(id: ID!, organizationId: ID): InboxProviderAccountCheck!
	}
`;
