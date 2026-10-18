// cspell:ignore dmarc
import { gql } from 'graphql-tag';

/**
 * The Inbox email features' contribution to the one GraphQL schema: the GraphQL twins of the management routes
 * (`/api/inbox/providers`, `/api/inbox/provider-accounts*`, `/api/inbox/mailboxes*`) and of the stored-message routes
 * (`/api/inbox/emails*`, except the raw-message and attachment downloads, which are byte streams). It is registered
 * only with `InboxEmailPlugin`, so a deployment without `GAUZY_INBOX_ENABLED=true` and
 * `GAUZY_INBOX_EMAIL_ENABLED=true` serves none of it (and the committed schema snapshot, composed from the default
 * plugin list, does not carry it). The field-binding gate reads this document on top of the snapshot — it is named in
 * `GATED_PLUGIN_SCHEMAS` of `tools/scripts/graphql-field-binding-check.mjs` — so it must stay a plain `gql` template
 * (no `${…}`), registered by `InboxEmailPlugin` as `schema: inboxEmailSchemaExtensions`.
 *
 * Every field reaches the service method its REST route reaches, with the route's DTO rules, guards and permission.
 * Secrets are write-only exactly as over REST: an account answers which secret fields are set (`secretsSet`), never
 * their values; a mailbox never answers its relay secret's digest or its domain verification token; a secret the
 * server generates is answered once, by the mutation that generated it (an account's generated credential, a
 * mailbox's rotated relay secret). Enumerated values (`scope`, `status`, `kind`, …) are strings holding the REST
 * values, so a new value is an additive change.
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

	"A mailbox of the organization: never its relay secret or its domain verification token."
	type InboxMailbox {
		id: ID!
		tenantId: ID
		organizationId: ID
		createdAt: DateTime
		updatedAt: DateTime
		isActive: Boolean
		"Lower case, unique across the platform."
		address: String!
		displayName: String
		"PLATFORM, CUSTOM_DOMAIN, FORWARDING or CONNECTED."
		kind: String!
		"EMPLOYEE, ORGANIZATION or TEAM."
		ownerType: String!
		ownerEmployeeId: ID
		ownerTeamId: ID
		"INBOX (DOCS_CAPTURE is reserved)."
		purpose: String!
		"The provider account it receives through; null = the platform route."
		providerAccountId: ID
		senderAllowlist: [String!]!
		"A custom domain's name."
		domain: String
		"A custom domain's DNS proof: PENDING, VERIFIED or FAILED."
		domainStatus: String
		"The owner's default mailbox."
		isDefault: Boolean!
		autoProvisioned: Boolean!
		lastMessageAt: DateTime
		messageCount: Int!
		"Free settings; everWorksAgentId routes the mailbox's mail to that Ever Works agent."
		settings: JSON
	}

	"The DNS TXT record that proves a custom domain, and its last status."
	type InboxMailboxDomainVerification {
		"TXT."
		recordType: String!
		"_gauzy-inbox.<domain>"
		recordName: String!
		recordValue: String!
		"PENDING, VERIFIED or FAILED."
		status: String!
		message: String
	}

	"A mailbox just created, with the DNS record to create when it is on a custom domain."
	type InboxMailboxCreated {
		id: ID!
		tenantId: ID
		organizationId: ID
		createdAt: DateTime
		updatedAt: DateTime
		isActive: Boolean
		"Lower case, unique across the platform."
		address: String!
		displayName: String
		"PLATFORM, CUSTOM_DOMAIN, FORWARDING or CONNECTED."
		kind: String!
		"EMPLOYEE, ORGANIZATION or TEAM."
		ownerType: String!
		ownerEmployeeId: ID
		ownerTeamId: ID
		"INBOX (DOCS_CAPTURE is reserved)."
		purpose: String!
		"The provider account it receives through; null = the platform route."
		providerAccountId: ID
		senderAllowlist: [String!]!
		"A custom domain's name."
		domain: String
		"A custom domain's DNS proof: PENDING, VERIFIED or FAILED."
		domainStatus: String
		"The owner's default mailbox."
		isDefault: Boolean!
		autoProvisioned: Boolean!
		lastMessageAt: DateTime
		messageCount: Int!
		"Free settings; everWorksAgentId routes the mailbox's mail to that Ever Works agent."
		settings: JSON
		"Custom domains only: the TXT record to create, then verifyInboxMailboxDomain."
		verification: InboxMailboxDomainVerification
	}

	"One of my mailboxes (my employee mailbox, and the shared ones I receive), with the forwarding instructions."
	type InboxMyMailbox {
		id: ID!
		tenantId: ID
		organizationId: ID
		createdAt: DateTime
		updatedAt: DateTime
		isActive: Boolean
		"Lower case, unique across the platform."
		address: String!
		displayName: String
		"PLATFORM, CUSTOM_DOMAIN, FORWARDING or CONNECTED."
		kind: String!
		"EMPLOYEE, ORGANIZATION or TEAM."
		ownerType: String!
		ownerEmployeeId: ID
		ownerTeamId: ID
		"INBOX (DOCS_CAPTURE is reserved)."
		purpose: String!
		"The provider account it receives through; null = the platform route."
		providerAccountId: ID
		senderAllowlist: [String!]!
		"A custom domain's name."
		domain: String
		"A custom domain's DNS proof: PENDING, VERIFIED or FAILED."
		domainStatus: String
		"The owner's default mailbox."
		isDefault: Boolean!
		autoProvisioned: Boolean!
		lastMessageAt: DateTime
		messageCount: Int!
		"Free settings; everWorksAgentId routes the mailbox's mail to that Ever Works agent."
		settings: JSON
		"How to forward an existing mailbox to this address (platform and forwarding mailboxes)."
		forwardingInstructions: String
	}

	"A mailbox's new relay secret: answered this once, stored as a digest."
	type InboxMailboxSecret {
		address: String!
		inboundSecret: String!
	}

	"A member of a shared (organization or team) mailbox."
	type InboxMailboxMember {
		userId: ID!
		"READER or MANAGER."
		role: String!
	}

	"What a provisioning run created."
	type InboxMailboxProvisionResult {
		created: [InboxMailbox!]!
		"Owners that already had a mailbox."
		existing: Int!
	}

	"An organization's Inbox email settings."
	type InboxOrganizationEmailSettings {
		organizationId: ID!
		"Create a mailbox for every new (human) employee."
		autoProvisionEmployees: Boolean!
		"The platform mailbox domain of this server; null when none is set (custom domains only)."
		platformDomain: String
	}

	"An address of a stored message."
	type InboxEmailAddress {
		address: String!
		name: String
	}

	"An attachment of a stored message: metadata only (the bytes are a REST download)."
	type InboxEmailAttachment {
		id: ID!
		emailId: ID!
		filename: String!
		contentType: String
		size: Int!
		sha256: String
		contentId: String
		isInline: Boolean!
		"The Docs document it was saved as."
		savedDocumentId: ID
	}

	"A stored message of one of my mailboxes; htmlSanitized is sanitized on the server (render it sandboxed)."
	type InboxEmail {
		id: ID!
		tenantId: ID
		organizationId: ID
		createdAt: DateTime
		updatedAt: DateTime
		mailboxId: ID!
		threadId: ID
		"IN or OUT."
		direction: String!
		messageId: String!
		inReplyTo: String
		references: [String!]!
		from: InboxEmailAddress
		to: [InboxEmailAddress!]!
		cc: [InboxEmailAddress!]!
		bcc: [InboxEmailAddress!]!
		replyTo: [InboxEmailAddress!]!
		subject: String
		textBody: String
		htmlSanitized: String
		snippet: String
		"The allowlisted headers."
		headers: JSON
		spf: String
		dkim: String
		dmarc: String
		spamScore: Float
		"ham, suspect or spam."
		spamVerdict: String
		receivedAt: DateTime
		sentAt: DateTime
		sizeBytes: Int
		"RECEIVED, PROCESSING, PROCESSED, QUARANTINED, FAILED, QUEUED or SENT."
		status: String!
		providerMessageId: String
		error: String
		inboxItemId: ID
		"The attachments' metadata (inboxEmail only)."
		attachments: [InboxEmailAttachment!]
	}

	"A new mailbox (the body of POST /inbox/mailboxes)."
	input CreateInboxMailboxInput {
		"EMPLOYEE, ORGANIZATION or TEAM."
		ownerType: String!
		"EMPLOYEE mailboxes."
		ownerEmployeeId: ID
		"TEAM mailboxes."
		ownerTeamId: ID
		"PLATFORM (default), CUSTOM_DOMAIN or FORWARDING."
		kind: String
		"The address's local part (at most 64 characters); allocated from the owner when left out."
		localPart: String
		"CUSTOM_DOMAIN: the organization's domain (proven by a DNS TXT record before it receives)."
		domain: String
		displayName: String
		"Required for a custom domain; null or left out = the platform route."
		providerAccountId: ID
		"At most 200 addresses or domains."
		senderAllowlist: [String!]
		"The organization (default: the request's selected organization); the caller must be a member."
		organizationId: ID
		isDefault: Boolean
		"FORWARDING: the existing address that forwards to this one."
		forwardFrom: String
	}

	"A change of a mailbox (the body of PATCH /inbox/mailboxes/:id)."
	input UpdateInboxMailboxInput {
		displayName: String
		"false stops it receiving."
		isActive: Boolean
		senderAllowlist: [String!]
		"null = the platform route."
		providerAccountId: ID
		isDefault: Boolean
		"Free settings; everWorksAgentId routes the mailbox's mail to that Ever Works agent."
		settings: JSON
	}

	"A member of a shared mailbox (PUT /inbox/mailboxes/:id/members)."
	input InboxMailboxMemberInput {
		userId: ID!
		"READER (default) or MANAGER."
		role: String
	}

	"What a provisioning run creates (the body of POST /inbox/mailboxes/provision)."
	input ProvisionInboxMailboxesInput {
		organizationId: ID
		"A mailbox for every active (human) employee that has none."
		employees: Boolean
		"The organization's default mailbox when it has none."
		defaultOrganizationMailbox: Boolean
	}

	"An organization's Inbox email settings (the body of PUT /inbox/mailboxes/settings)."
	input InboxEmailSettingsInput {
		autoProvisionEmployees: Boolean!
	}

	"A reply from the mailbox's address, in the message's thread (the body of POST /inbox/emails/:id/reply)."
	input InboxEmailReplyInput {
		text: String!
		"Also to the original To and Cc (minus the mailbox itself)."
		replyAll: Boolean
		cc: [String!]
	}

	"A forward from the mailbox's address (the body of POST /inbox/emails/:id/forward)."
	input InboxEmailForwardInput {
		to: [String!]!
		text: String
		"Defaults to true."
		includeAttachments: Boolean
	}

	extend type Query {
		"The email provider plugins of this server, with their capabilities and forms (GET /inbox/providers; INBOX_MAILBOX_MANAGE)."
		inboxEmailProviders: [InboxEmailProvider!]!
		"The organization's and the tenant's provider accounts (GET /inbox/provider-accounts; INBOX_MAILBOX_MANAGE)."
		inboxProviderAccounts(organizationId: ID): [InboxProviderAccount!]!
		"One provider account (GET /inbox/provider-accounts/:id; INBOX_MAILBOX_MANAGE)."
		inboxProviderAccount(id: ID!, organizationId: ID): InboxProviderAccount
		"My mailboxes, with the forwarding instructions (GET /inbox/mailboxes/mine; INBOX_VIEW)."
		myInboxMailboxes: [InboxMyMailbox!]!
		"The organization's mailboxes (GET /inbox/mailboxes; INBOX_MAILBOX_MANAGE)."
		inboxMailboxes(organizationId: ID): [InboxMailbox!]!
		"One mailbox (GET /inbox/mailboxes/:id; INBOX_MAILBOX_MANAGE)."
		inboxMailbox(id: ID!, organizationId: ID): InboxMailbox
		"A custom domain's DNS TXT record and its last status, without a lookup (GET /inbox/mailboxes/:id/verification; INBOX_MAILBOX_MANAGE)."
		inboxMailboxDomainVerification(id: ID!, organizationId: ID): InboxMailboxDomainVerification!
		"The members of a shared mailbox (GET /inbox/mailboxes/:id/members; INBOX_MAILBOX_MANAGE)."
		inboxMailboxMembers(id: ID!, organizationId: ID): [InboxMailboxMember!]!
		"The organization's Inbox email settings (GET /inbox/mailboxes/settings; INBOX_MAILBOX_MANAGE)."
		inboxEmailSettings(organizationId: ID): InboxOrganizationEmailSettings!
		"One stored message of a mailbox I can read, with its attachments' metadata (GET /inbox/emails/:id; INBOX_VIEW)."
		inboxEmail(id: ID!): InboxEmail
		"The messages of a message's thread, oldest first (GET /inbox/emails/:id/thread; INBOX_VIEW)."
		inboxEmailThread(id: ID!): [InboxEmail!]!
		"The quarantined messages of a mailbox, for its managers (GET /inbox/emails/quarantine; INBOX_VIEW)."
		inboxQuarantinedEmails(mailboxId: ID!): [InboxEmail!]!
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
		"Create a mailbox: platform address, custom domain or forwarding (POST /inbox/mailboxes; INBOX_MAILBOX_MANAGE)."
		createInboxMailbox(input: CreateInboxMailboxInput!): InboxMailboxCreated!
		"Rename, (de)activate, change the allowlist, the account, the default or the settings (PATCH /inbox/mailboxes/:id; INBOX_MAILBOX_MANAGE)."
		updateInboxMailbox(id: ID!, input: UpdateInboxMailboxInput!, organizationId: ID): InboxMailbox!
		"Check a custom domain's DNS TXT record (POST /inbox/mailboxes/:id/verify; INBOX_MAILBOX_MANAGE)."
		verifyInboxMailboxDomain(id: ID!, organizationId: ID): InboxMailboxDomainVerification!
		"A new relay secret for the mailbox, answered this once (POST /inbox/mailboxes/:id/rotate-secret; INBOX_MAILBOX_MANAGE)."
		rotateInboxMailboxSecret(id: ID!, organizationId: ID): InboxMailboxSecret!
		"Replace the members of a shared mailbox (PUT /inbox/mailboxes/:id/members; INBOX_MAILBOX_MANAGE)."
		setInboxMailboxMembers(
			id: ID!
			members: [InboxMailboxMemberInput!]!
			organizationId: ID
		): [InboxMailboxMember!]!
		"Create the missing employee mailboxes and the default organization mailbox now (POST /inbox/mailboxes/provision; INBOX_MAILBOX_MANAGE)."
		provisionInboxMailboxes(input: ProvisionInboxMailboxesInput): InboxMailboxProvisionResult!
		"Create a mailbox for every new employee, or stop doing so (PUT /inbox/mailboxes/settings; INBOX_MAILBOX_MANAGE)."
		updateInboxEmailSettings(input: InboxEmailSettingsInput!, organizationId: ID): InboxOrganizationEmailSettings!
		"Reply from the mailbox's address, in the thread (POST /inbox/emails/:id/reply; INBOX_VIEW)."
		replyInboxEmail(id: ID!, input: InboxEmailReplyInput!): InboxEmail!
		"Forward the message, with its attachments by default, from the mailbox's address (POST /inbox/emails/:id/forward; INBOX_VIEW)."
		forwardInboxEmail(id: ID!, input: InboxEmailForwardInput!): InboxEmail!
		"Release a quarantined message into its mailbox's recipients' inboxes, for its managers (POST /inbox/emails/:id/release; INBOX_VIEW)."
		releaseInboxEmail(id: ID!): InboxEmail!
	}
`;
