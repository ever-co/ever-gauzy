import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';
import { ITask } from './task.model';

/**
 * Chat (`@gauzy/plugin-chat`): conversations between the employees of an organization — channels, direct and
 * group messages — with threads, reactions, pins, mentions, attachments and task references. The contracts
 * below are the API every client (the Angular app, Ever Teams, the MCP server, the SDKs) builds on.
 */

/** What kind of conversation. */
export enum ChatConversationKindEnum {
	/** A named channel of the organization, public (anyone may join) or private (members only). */
	CHANNEL = 'channel',
	/** Two people. */
	DIRECT = 'direct',
	/** Three or more people, no name needed. */
	GROUP = 'group'
}

export enum ChatVisibilityEnum {
	PUBLIC = 'public',
	PRIVATE = 'private'
}

export enum ChatMemberRoleEnum {
	MEMBER = 'member',
	/** May edit the conversation and its members (the creator is one; `CHAT_MANAGE` holders act as one everywhere). */
	MANAGER = 'manager'
}

/** How much of a conversation reaches a member as notifications. */
export enum ChatNotifyLevelEnum {
	ALL = 'all',
	MENTIONS = 'mentions',
	MUTED = 'muted'
}

export enum ChatMessageKindEnum {
	/** Written by a member. */
	MESSAGE = 'message',
	/** Written by the platform (joined, left, pinned, …). */
	SYSTEM = 'system',
	/** Posted by an integration (an incoming webhook). */
	APP = 'app'
}

/** How a task got attached to a message. */
export enum ChatTaskReferenceKindEnum {
	/** A task identifier or link typed in the message. */
	MENTION = 'mention',
	/** "Send to chat" from the task. */
	SENT = 'sent',
	/** "Create task from message". */
	CREATED = 'created'
}

/** The most characters a message body may hold. */
export const CHAT_MESSAGE_MAX_LENGTH = 4000;
/** The most members a group message may have; a channel has no limit. */
export const CHAT_GROUP_MAX_MEMBERS = 50;
/** The most attachments one message may carry. */
export const CHAT_MESSAGE_MAX_ATTACHMENTS = 10;
/** The name of the channel every employee is in (created when chat is enabled for an organization). */
export const CHAT_DEFAULT_CHANNEL_NAME = 'general';

/**
 * Mention tokens inside a message body: rename-safe references the clients render as chips.
 * `<@employeeId>`, `<#conversationId>`, `<!channel>` (every member) and `<!here>` (every member, meant as "now").
 */
export const CHAT_MENTION_TOKEN_PATTERN = /<(@|#)([0-9a-fA-F-]{36})>|<!(channel|here)>/g;

/** The events chat appends to the event outbox (content-free, addressed to the members concerned). */
export const CHAT_EVENT_NAMES = {
	MESSAGE_CREATED: 'chat_message.created',
	MESSAGE_UPDATED: 'chat_message.updated',
	MESSAGE_DELETED: 'chat_message.deleted',
	CONVERSATION_CHANGED: 'chat_conversation.changed',
	MEMBER_STATE_CHANGED: 'chat_member.state_changed',
	THREAD_CHANGED: 'chat_thread.changed'
} as const;

export type ChatEventName = (typeof CHAT_EVENT_NAMES)[keyof typeof CHAT_EVENT_NAMES];
export const CHAT_STREAMED_EVENTS: readonly ChatEventName[] = Object.values(CHAT_EVENT_NAMES);

// ------------------------------------------------------------------ records

export interface IChatCategory extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	position: number;
}

export interface IChatConversation extends IBasePerTenantAndOrganizationEntityModel {
	kind: ChatConversationKindEnum;
	name?: string | null;
	topic?: string | null;
	visibility: ChatVisibilityEnum;
	categoryId?: ID | null;
	position: number;
	/** The organization's default channel (every employee is a member and cannot leave). */
	isDefault: boolean;
	archivedAt?: Date;
	createdByEmployeeId?: ID | null;
	/** Messages posted to the conversation itself (thread replies not sent "also to the conversation" excluded). */
	messageCount: number;
	lastMessageAt?: Date | null;
}

/** One employee's membership in a conversation, with their own unread state. */
export interface IChatMember extends IBasePerTenantAndOrganizationEntityModel {
	conversationId: ID;
	employeeId: ID;
	userId: ID;
	role: ChatMemberRoleEnum;
	notifyLevel: ChatNotifyLevelEnum;
	isFavorite: boolean;
	/** How many of the conversation's messages this member has read (`unread = messageCount − readCount`). */
	readCount: number;
	/** Unread messages that mention this member (or everyone). */
	mentionCount: number;
	lastReadMessageId?: ID | null;
	lastReadAt?: Date | null;
	joinedAt?: Date | null;
	leftAt?: Date | null;
}

/** The caller's own state of a conversation, as the list and the states call answer it. */
export interface IChatMemberState {
	conversationId: ID;
	role: ChatMemberRoleEnum;
	notifyLevel: ChatNotifyLevelEnum;
	isFavorite: boolean;
	unreadCount: number;
	mentionCount: number;
	lastReadMessageId: ID | null;
	lastReadAt: Date | null;
}

/** A conversation with the caller's state and a few members for display. */
export interface IChatConversationWithState extends IChatConversation {
	state: IChatMemberState | null;
	memberCount: number;
	/** Up to the first few members (for the avatars of a direct or group conversation). */
	members?: IChatMemberSummary[];
}

/** A person chat shows: an active employee of the organization, with the name and picture any chat user may see. */
export interface IChatPerson {
	employeeId: ID;
	userId: ID;
	name: string;
	imageUrl: string | null;
}

export interface IChatMemberSummary {
	employeeId: ID;
	userId: ID;
	role: ChatMemberRoleEnum;
	joinedAt?: Date | null;
}

export interface IChatReactionSummary {
	emoji: string;
	count: number;
	/** Whether the caller reacted with it. */
	mine: boolean;
}

export interface IChatTaskReference {
	messageId: ID;
	taskId: ID;
	kind: ChatTaskReferenceKindEnum;
}

export interface IChatMessage extends IBasePerTenantAndOrganizationEntityModel {
	conversationId: ID;
	authorEmployeeId?: ID | null;
	authorUserId?: ID | null;
	kind: ChatMessageKindEnum;
	/** Markdown subset with mention tokens; empty for a deleted message (`deletedAt` set). */
	body: string;
	mentionEmployeeIds?: ID[] | null;
	mentionsChannel: boolean;
	mentionsHere: boolean;
	/** A quoted message of the same conversation. */
	replyToId?: ID | null;
	/** The root message of the thread this reply belongs to. */
	threadRootId?: ID | null;
	/** A thread reply that was also posted to the conversation. */
	alsoInConversation: boolean;
	replyCount: number;
	lastReplyAt?: Date | null;
	pinnedAt?: Date | null;
	pinnedByEmployeeId?: ID | null;
	editedAt?: Date | null;
	/** Document ids (files uploaded through the Docs plugin). */
	attachmentIds?: ID[] | null;
	/** The sender's idempotency key. */
	nonce?: string | null;
	/** The name of the integration that posted an APP message. */
	appName?: string | null;
	/** The incoming webhook that posted an APP message. */
	webhookId?: ID | null;
	/** The icon of the integration that posted an APP message (https). */
	appIconUrl?: string | null;
	/** The structured layout of an APP message (plain text throughout); `body` is its text fallback. */
	blocks?: IChatAppBlock[] | null;
	/** The assistant a person wrote this message with (an AI client posting in their name), shown beside it. */
	assistedBy?: string | null;
	deletedAt?: Date;
}

/** A message as the read API answers it. */
export interface IChatMessageWithRelations extends IChatMessage {
	reactions?: IChatReactionSummary[];
	taskReferences?: IChatTaskReference[];
	/** Whether the caller follows the thread this message roots. */
	following?: boolean;
}

export interface IChatThreadFollow extends IBasePerTenantAndOrganizationEntityModel {
	rootMessageId: ID;
	employeeId: ID;
	userId: ID;
	unreadReplies: number;
	lastReadReplyAt?: Date | null;
}

// ------------------------------------------------------------------ inputs

export interface IChatCategoryInput {
	name: string;
	position?: number;
}

export interface IChatConversationCreateInput {
	name: string;
	topic?: string | null;
	visibility?: ChatVisibilityEnum;
	categoryId?: ID | null;
	/** Employees to add besides the creator. */
	memberEmployeeIds?: ID[];
}

export interface IChatConversationUpdateInput {
	name?: string;
	topic?: string | null;
	visibility?: ChatVisibilityEnum;
	categoryId?: ID | null;
	position?: number;
}

/** `POST /chat/direct`: find or create the direct (2) or group (3+) conversation of these employees and the caller. */
export interface IChatDirectInput {
	employeeIds: ID[];
}

export interface IChatMembersInput {
	employeeIds: ID[];
}

export interface IChatMemberStateInput {
	notifyLevel?: ChatNotifyLevelEnum;
	isFavorite?: boolean;
}

/** `POST /chat/conversations/:id/read`: read up to a message (default: the newest). */
export interface IChatReadInput {
	messageId?: ID;
}

export interface IChatMessageCreateInput {
	body: string;
	/** Idempotency key chosen by the client (a UUID, unique for the sender): the same key answers the same message, however late. */
	nonce?: string;
	replyToId?: ID;
	threadRootId?: ID;
	alsoInConversation?: boolean;
	attachmentIds?: ID[];
	/** The employees mentioned (the tokens in the body are the source of truth; this is the client's hint). */
	mentionEmployeeIds?: ID[];
	/** "Send to chat": the task to attach as a card. */
	taskId?: ID;
	/** The assistant the sender wrote this message with (an AI client posting in their name): shown beside it. */
	assistedBy?: string;
}

export interface IChatMessageUpdateInput {
	body: string;
	attachmentIds?: ID[];
	mentionEmployeeIds?: ID[];
}

export interface IChatMessagesQuery {
	/** Messages older than this message id. */
	before?: ID;
	/** Messages newer than this message id. */
	after?: ID;
	/** A window around this message id (jump to message). */
	around?: ID;
	limit?: number;
}

export interface IChatMessagePage {
	messages: IChatMessageWithRelations[];
	/** Whether older messages exist before the first one. */
	hasBefore: boolean;
	/** Whether newer messages exist after the last one. */
	hasAfter: boolean;
}

export interface IChatConversationList {
	conversations: IChatConversationWithState[];
	categories: IChatCategory[];
}

export interface IChatStates {
	states: IChatMemberState[];
	/** Followed threads with unread replies. */
	threads: Array<{ rootMessageId: ID; conversationId: ID; unreadReplies: number }>;
}

/** What a write answers besides its record: the events it caused, so the sender applies them at once. */
export interface IChatEvent {
	name: ChatEventName;
	data: JsonData;
}

export interface IChatSendResult {
	message: IChatMessageWithRelations;
	events: IChatEvent[];
}

/** `POST /chat/messages/:id/thread/read`: whether a follow of the caller was marked read. */
export interface IChatThreadReadResult {
	updated: boolean;
}

export interface IChatReadAllResult {
	updated: number;
	/** Undo handle, valid for a minute. */
	snapshotId: string;
}

/** One file of a conversation: the document a message carries, as the files pane lists it. */
export interface IChatFile {
	documentId: ID;
	messageId: ID;
	conversationId: ID;
	name: string;
	originalFilename?: string | null;
	mimeType?: string | null;
	fileSize?: number | null;
	status?: string | null;
	fileUrl?: string | null;
	thumbUrl?: string | null;
	authorEmployeeId?: ID | null;
	authorUserId?: ID | null;
	/** When the file was attached (the message's send). */
	attachedAt: Date;
}

/** `GET /chat/conversations/:id/files`: newest first, paged. */
export interface IChatFilesQuery {
	limit?: number;
	skip?: number;
}

/** `GET /chat/search`: a query over the messages of my conversations (one of them when `conversationId` is given). */
export interface IChatSearchQuery {
	q: string;
	conversationId?: ID;
	limit?: number;
	skip?: number;
}

export interface IChatFilesResult {
	files: IChatFile[];
	hasMore: boolean;
}

export interface IChatSearchResult {
	/** The matching messages, best match first, with their relations. */
	messages: IChatMessageWithRelations[];
	/** How many messages match in all (the search index's count). */
	total: number;
	hasMore: boolean;
}

export interface IChatCreateTaskInput {
	projectId?: ID;
	/** The team the task belongs to, so the team's lists show it: a team of the conversation's organization. */
	organizationTeamId?: ID;
	/** The task's title; the message's first line when left out. */
	title?: string;
	assigneeEmployeeIds?: ID[];
}

/** `POST /chat/messages/:id/create-task`: the task, the message's reference to it, and the events the change caused. */
export interface IChatCreateTaskResult {
	task: ITask;
	reference: IChatTaskReference;
	events: IChatEvent[];
}

// ------------------------------------------------------------------ incoming webhooks (`GAUZY_CHAT_WEBHOOKS_ENABLED`)

/** The most active webhooks one channel may have. */
export const CHAT_WEBHOOK_MAX_PER_CONVERSATION = 10;
/** The most bytes a webhook post may weigh (the raw body). */
export const CHAT_WEBHOOK_MAX_PAYLOAD_BYTES = 64 * 1024;
/** The most blocks one app message may carry (legacy attachments count by the blocks they become). */
export const CHAT_WEBHOOK_MAX_BLOCKS = 50;
/** The most fields one section block shows side by side. */
export const CHAT_WEBHOOK_MAX_FIELDS = 10;
/** The most buttons one actions block carries. */
export const CHAT_WEBHOOK_MAX_BUTTONS = 10;
/** The longest webhook name. */
export const CHAT_WEBHOOK_NAME_MAX_LENGTH = 80;

/**
 * The blocks an app message renders. Every text is plain text (no HTML, no markup): clients render it as text.
 * A block type outside this set arrives as a `text` block holding whatever text it had.
 */
export enum ChatAppBlockTypeEnum {
	/** A title line. */
	HEADER = 'header',
	/** A paragraph, and/or short fields shown side by side. */
	SECTION = 'section',
	/** A horizontal rule. */
	DIVIDER = 'divider',
	/** Small, muted text (a footer, a source, a time). */
	CONTEXT = 'context',
	/** A row of buttons. */
	ACTIONS = 'actions',
	/** Plain text: what an unknown block type is rendered as. */
	TEXT = 'text'
}

export type ChatAppButtonStyle = 'primary' | 'danger';

/**
 * A button of an actions block. With `url` it opens that page (https, public host) and calls nobody back; without it,
 * a click is an interaction posted to the webhook's interaction URL.
 */
export interface IChatAppButton {
	/** Unique within the message: the interaction names it. */
	actionId: string;
	text: string;
	/** Sent back with the interaction (the stored value, never the client's). */
	value?: string | null;
	url?: string | null;
	style?: ChatAppButtonStyle | null;
}

export type IChatAppBlock =
	| { type: ChatAppBlockTypeEnum.HEADER; text: string }
	| { type: ChatAppBlockTypeEnum.SECTION; text?: string | null; fields?: string[] | null }
	| { type: ChatAppBlockTypeEnum.DIVIDER }
	| { type: ChatAppBlockTypeEnum.CONTEXT; elements: string[] }
	| { type: ChatAppBlockTypeEnum.ACTIONS; blockId?: string | null; elements: IChatAppButton[] }
	| { type: ChatAppBlockTypeEnum.TEXT; text: string };

/** One incoming webhook of a channel, as the management routes answer it (never its secrets). */
export interface IChatWebhook extends IBasePerTenantAndOrganizationEntityModel {
	conversationId: ID;
	name: string;
	iconUrl?: string | null;
	/** Where button clicks are posted (signed). None: the webhook's buttons call nobody back. */
	interactionUrl?: string | null;
	/** The last characters of the URL secret, so two webhooks can be told apart. */
	tokenHint: string;
	/** Whether a signing secret exists (interactions need one). */
	hasSigningSecret: boolean;
	/** Whether `@channel` / `@here` in its posts notify the channel. */
	canBroadcast: boolean;
	createdByEmployeeId?: ID | null;
	createdByUserId?: ID | null;
	revokedAt?: Date | null;
	revokedByEmployeeId?: ID | null;
	lastUsedAt?: Date | null;
	acceptedCount: number;
	rejectedCount: number;
	rateLimitedCount: number;
	callbackFailureCount: number;
}

export interface IChatWebhookCreateInput {
	name: string;
	iconUrl?: string | null;
	interactionUrl?: string | null;
	canBroadcast?: boolean;
}

export interface IChatWebhookUpdateInput {
	name?: string;
	/** `null` clears it. */
	iconUrl?: string | null;
	/** `null` clears it. */
	interactionUrl?: string | null;
	canBroadcast?: boolean;
}

/** A webhook write's answer: the webhook, and the secrets made by this write (shown this once, never again). */
export interface IChatWebhookWriteResult {
	webhook: IChatWebhook;
	/** The URL senders post to (holds the URL secret): only in the answer of the create. */
	url?: string;
	/** The key interaction callbacks are signed with: only in the answer of the write that made it. */
	signingSecret?: string;
}

export enum ChatInteractionStatusEnum {
	/** Being posted (the first attempt). */
	PENDING = 'pending',
	/** The interaction URL answered 2xx. */
	DELIVERED = 'delivered',
	/** An attempt failed; more follow. */
	RETRYING = 'retrying',
	/** Every attempt failed, or the target was refused. */
	FAILED = 'failed'
}

/** `POST /chat/messages/:id/interactions`: the button clicked. */
export interface IChatInteractionInput {
	actionId: string;
	/** The actions block of the button, when two blocks reuse an action id. */
	blockId?: string;
}

/** The state of one click. */
export interface IChatInteraction {
	/** Created once per click, the same on every retry of its callback (also sent as `Idempotency-Key`). */
	interactionId: ID;
	messageId: ID;
	conversationId: ID;
	actionId: string;
	status: ChatInteractionStatusEnum;
	attempts: number;
	/** Whether the sender's reply replaced the message. */
	replyApplied: boolean;
	/** Why the callback failed (no host, no address). */
	error?: string | null;
	createdAt?: Date;
}

export interface IChatInteractionResult {
	interaction: IChatInteraction;
	/** The message as the sender's reply left it (when it replied). */
	message?: IChatMessageWithRelations;
	events: IChatEvent[];
}

/** The body an interaction callback POSTs to the interaction URL (signed with `X-Signature`). */
export interface IChatInteractionCallback {
	type: 'block_actions';
	interactionId: ID;
	/** ISO time of the click. */
	actionAt: string;
	webhook: { id: ID; name: string };
	conversation: { id: ID; name: string | null };
	message: { id: ID; createdAt: string | null };
	/** Who clicked: the employee id and the display name only. */
	actor: { employeeId: ID; name: string };
	action: { actionId: string; blockId: string | null; value: string | null; text: string };
}
