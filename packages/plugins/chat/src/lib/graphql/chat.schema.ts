import { gql } from 'graphql-tag';

/**
 * The chat's contribution to the one GraphQL schema (the chat spec, T17: "GraphQL twins, gated schema, for the
 * read routes"). It is registered only with the plugin, so a deployment without `GAUZY_CHAT_ENABLED=true` serves
 * none of it (and the committed schema snapshot, composed from the default plugin list, does not carry it). The
 * field-binding gate reads this document on top of the snapshot — it is named in `GATED_PLUGIN_SCHEMAS` of
 * `tools/scripts/graphql-field-binding-check.mjs` — so it must stay a plain `gql` template (no `${…}`), registered
 * by `ChatPlugin` as `schema: chatSchemaExtensions`.
 *
 * Every field acts as the caller, taken from the credential and never from an argument, exactly as on `/api/chat`:
 * a conversation the caller is not a member of is the route's 404. Enumerated values (`kind`, `visibility`,
 * `role`, `notifyLevel`, …) are strings holding the REST values, so a value read over GraphQL and over REST are
 * identical, and a new value is an additive change. The writes stay REST for now (the next slice).
 */
export const chatSchemaExtensions = gql`
	"A sidebar category channels are grouped under."
	type ChatCategory {
		id: ID!
		tenantId: ID
		organizationId: ID
		name: String!
		position: Int!
	}
	"The caller's own state of a conversation."
	type ChatMemberState {
		conversationId: ID!
		role: String!
		notifyLevel: String!
		isFavorite: Boolean!
		unreadCount: Int!
		mentionCount: Int!
		lastReadMessageId: ID
		lastReadAt: DateTime
	}
	"One of the first few members of a conversation (for the avatars), or one of its members."
	type ChatMemberSummary {
		employeeId: ID!
		userId: ID!
		role: String!
		joinedAt: DateTime
	}
	"A conversation with the caller's state and a few members for display."
	type ChatConversation {
		id: ID!
		tenantId: ID
		organizationId: ID
		kind: String!
		name: String
		topic: String
		visibility: String!
		categoryId: ID
		position: Int!
		"The organization's default channel (every employee is a member and cannot leave)."
		isDefault: Boolean!
		archivedAt: DateTime
		createdByEmployeeId: ID
		"Messages posted to the conversation itself."
		messageCount: Int!
		lastMessageAt: DateTime
		createdAt: DateTime
		updatedAt: DateTime
		"The caller's own state; null on a public channel the caller is not in (browse)."
		state: ChatMemberState
		memberCount: Int!
		members: [ChatMemberSummary!]
	}
	"My conversations with my state, and the categories."
	type ChatConversationList {
		conversations: [ChatConversation!]!
		categories: [ChatCategory!]!
	}
	"A followed thread with unread replies."
	type ChatFollowedThreadState {
		rootMessageId: ID!
		conversationId: ID!
		unreadReplies: Int!
	}
	"My state of every conversation (for badges) and my followed threads with unread replies."
	type ChatStates {
		states: [ChatMemberState!]!
		threads: [ChatFollowedThreadState!]!
	}
	"A person chat shows: an active employee of the organization, with the name and picture any chat user may see."
	type ChatPerson {
		employeeId: ID!
		userId: ID!
		name: String!
		imageUrl: String
		position: String
		"active, idle or offline, by the server clock when the list was read."
		presence: String
		lastSeenAt: DateTime
	}
	type ChatReactionSummary {
		emoji: String!
		count: Int!
		"Whether the caller reacted with it."
		mine: Boolean!
	}
	type ChatTaskReference {
		messageId: ID!
		taskId: ID!
		kind: String!
	}
	"A message as the read routes answer it: with its reactions, its task references and whether the caller follows its thread."
	type ChatMessage {
		id: ID!
		tenantId: ID
		organizationId: ID
		conversationId: ID!
		authorEmployeeId: ID
		authorUserId: ID
		kind: String!
		"Markdown subset with mention tokens; empty for a deleted message and for a message of files only."
		body: String!
		mentionEmployeeIds: [ID!]
		mentionsChannel: Boolean!
		mentionsHere: Boolean!
		replyToId: ID
		threadRootId: ID
		alsoInConversation: Boolean!
		replyCount: Int!
		lastReplyAt: DateTime
		pinnedAt: DateTime
		pinnedByEmployeeId: ID
		editedAt: DateTime
		attachmentIds: [ID!]
		"The names the attached files had when the message was sent or last edited, one per line."
		attachmentNames: String
		nonce: String
		appName: String
		"The incoming webhook that posted an app message."
		webhookId: ID
		"The icon of the app that posted the message (https)."
		appIconUrl: String
		"The layout of an app message (header, section, divider, context, actions, text blocks; plain text throughout)."
		blocks: JSON
		assistedBy: String
		deletedAt: DateTime
		createdAt: DateTime
		updatedAt: DateTime
		reactions: [ChatReactionSummary!]
		taskReferences: [ChatTaskReference!]
		following: Boolean
		"Unread replies of a thread the caller follows (the threads list)."
		unreadReplies: Int
	}
	"A page of messages: newest by default, or before / after / around a message id."
	type ChatMessagePage {
		messages: [ChatMessage!]!
		hasBefore: Boolean!
		hasAfter: Boolean!
	}
	"A thread: its root and its replies, oldest first."
	type ChatThread {
		root: ChatMessage!
		messages: [ChatMessage!]!
		hasBefore: Boolean!
		hasAfter: Boolean!
	}
	"The page of a messages or thread query (the query of the REST route)."
	input ChatMessagesQueryInput {
		"Messages older than this message id."
		before: ID
		"Messages newer than this message id."
		after: ID
		"A window around this message id (jump to message)."
		around: ID
		limit: Int
	}

	extend type Query {
		"GET /chat/people: the active employees of my organization, with name and picture."
		chatPeople: [ChatPerson!]!
		"GET /chat/categories: the sidebar categories channels are grouped under."
		chatCategories: [ChatCategory!]!
		"GET /chat/conversations: my conversations with my state, and the categories."
		chatConversations: ChatConversationList!
		"GET /chat/conversations/browse: public channels I am not in."
		chatBrowseConversations: [ChatConversation!]!
		"GET /chat/states: my state of every conversation and my followed threads with unread replies."
		chatStates: ChatStates!
		"GET /chat/conversations/:id: one conversation with my state; the route's 404 unless I am a member."
		chatConversation(id: ID!): ChatConversation!
		"GET /chat/conversations/:id/members: the members of a conversation I am in."
		chatConversationMembers(id: ID!): [ChatMemberSummary!]!
		"GET /chat/conversations/:id/messages: a page of messages."
		chatMessages(conversationId: ID!, query: ChatMessagesQueryInput): ChatMessagePage!
		"GET /chat/conversations/:id/pins: the pinned messages of a conversation."
		chatPins(conversationId: ID!): [ChatMessage!]!
		"GET /chat/threads: the threads I follow, with unread reply counts."
		chatThreads: [ChatMessage!]!
		"GET /chat/messages/:id/thread: a thread, its root and its replies, oldest first."
		chatThread(messageId: ID!, query: ChatMessagesQueryInput): ChatThread!
	}
`;
