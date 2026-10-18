import { gql } from 'graphql-tag';

/**
 * The Inbox's contribution to the one GraphQL schema (plan 04 §3: "GraphQL mirrors the read routes, plus
 * `markInboxItem`"; the REST↔GraphQL twins rule adds the reply and mark-all-read routes). It is registered only with the plugin, so a deployment without `GAUZY_INBOX_ENABLED=true`
 * serves none of it (and the committed schema snapshot, composed from the default plugin list, does not
 * carry it). The field-binding gate reads this document on top of the snapshot — it is named in
 * `GATED_PLUGIN_SCHEMAS` of `tools/scripts/graphql-field-binding-check.mjs` — so it must stay a plain `gql`
 * template (no `${…}`), registered by `InboxPlugin` as `schema: inboxSchemaExtensions`.
 *
 * Every field answers the caller's own items: the recipient is taken from the credential, never from an
 * argument, exactly as on `/api/inbox/items`. Enumerated values (`kind`, `status`, `tab`, …) are strings
 * holding the REST values, so a value read over GraphQL and over REST are identical, and a new value is an
 * additive change.
 */
export const inboxSchemaExtensions = gql`
	"One option of a question (or of an approval or escalation that offers choices)."
	type InboxItemOption {
		id: String!
		label: String!
		description: String
		"Highlighted in the reply pane."
		recommended: Boolean
	}

	"The answer an item received, and where its source routed it."
	type InboxItemResponse {
		text: String
		optionId: String
		answeredByUserId: ID
		answeredAt: DateTime
		"What the source did with the reply (for example 'already-decided'); 'local' without a source handler."
		routed: String
	}

	"The caller's own state of an item."
	type InboxItemRecipientState {
		isRead: Boolean!
		readAt: DateTime
		isArchived: Boolean
		archivedAt: DateTime
		snoozedUntil: DateTime
	}

	"An item of the caller's Inbox: a question, an approval, an escalation, a notice or an email."
	type InboxItem {
		id: ID!
		tenantId: ID
		organizationId: ID
		"QUESTION, APPROVAL, ESCALATION, NOTICE or EMAIL."
		kind: String!
		"EVER_WORKS, EMAIL, GAUZY, SYSTEM or a plugin's own source."
		source: String!
		"OPEN, ANSWERED, RESOLVED or CANCELLED."
		status: String!
		title: String!
		body: String
		bodyFormat: String!
		options: [InboxItemOption!]
		requireReason: Boolean!
		response: InboxItemResponse
		priority: String!
		dueAt: DateTime
		"The primary link (a task, a project, an agent, …)."
		entity: String
		entityId: ID
		taskId: ID
		projectId: ID
		agentEmployeeId: ID
		mailboxId: ID
		emailId: ID
		externalSource: String
		externalId: String
		metadata: JSON
		createdAt: DateTime
		updatedAt: DateTime
		"The caller's state; null for a reader of every mailbox who is not a recipient of it."
		recipient: InboxItemRecipientState
	}

	"A page of the caller's items, newest first."
	type InboxItemPage {
		items: [InboxItem!]!
		"Pass back as 'cursor' for the next page; null on the last page."
		nextCursor: String
	}

	"The unread count of one mailbox."
	type InboxMailboxUnreadCount {
		mailboxId: ID!
		unread: Int!
	}

	"The caller's badge numbers."
	type InboxItemCounts {
		unread: Int!
		decisionsOpen: Int!
		byMailbox: [InboxMailboxUnreadCount!]!
	}

	"The tab and the filters of the caller's items (the query of GET /inbox/items)."
	input InboxItemFilter {
		"all, decisions, email, snoozed or archived (default all)."
		tab: String
		kind: String
		source: String
		mailboxId: ID
		unread: Boolean
		"Searched in the title and the body (at most 200 characters)."
		q: String
		projectId: ID
		taskId: ID
		agentEmployeeId: ID
	}

	"The caller's state change of one item (the body of PATCH /inbox/items/:id/state)."
	input InboxItemStateInput {
		isRead: Boolean
		isArchived: Boolean
		"A time to snooze until; null un-snoozes."
		snoozedUntil: DateTime
	}

	"An answer to a question, an approval or an escalation (the body of POST /inbox/items/:id/reply)."
	input InboxItemReplyInput {
		"Free text (at most 10000 characters); a reason where the item requires one."
		text: String
		"The chosen option's id (at most 100 characters)."
		optionId: String
	}

	"What mark-all-read did."
	type InboxMarkAllReadResult {
		"How many of my unread items it marked read."
		updated: Int!
	}

	extend type Query {
		"A page of my inbox items, newest first (GET /inbox/items; INBOX_VIEW)."
		inboxItems(filter: InboxItemFilter, cursor: String, limit: Int): InboxItemPage!
		"My unread and open-decision counts (GET /inbox/items/counts; INBOX_VIEW)."
		inboxItemCounts: InboxItemCounts!
		"One of my inbox items, with my state (GET /inbox/items/:id; INBOX_VIEW)."
		inboxItem(id: ID!): InboxItem
	}

	extend type Mutation {
		"Mark one of my items read / unread, archive / unarchive or snooze it (PATCH /inbox/items/:id/state; INBOX_VIEW)."
		markInboxItem(id: ID!, input: InboxItemStateInput!): InboxItem!
		"Answer one of my questions, approvals or escalations; its source is told synchronously (POST /inbox/items/:id/reply; INBOX_VIEW)."
		replyInboxItem(id: ID!, input: InboxItemReplyInput!): InboxItem!
		"Mark every unread item of mine (of a tab: all, decisions, email, snoozed or archived) read (POST /inbox/items/mark-all-read; INBOX_VIEW)."
		markAllInboxItemsRead(tab: String): InboxMarkAllReadResult!
	}
`;
