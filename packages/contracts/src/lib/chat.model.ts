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
/** How long a typing signal holds: a client that hears nothing more from the typist after this drops "is typing". */
export const CHAT_TYPING_TTL_MS = 6000;
/** How often one member's typing in one place is told at most (a client signals again within the TTL to keep it). */
export const CHAT_TYPING_MIN_INTERVAL_MS = 2500;
/** How long an uploaded attachment that no message carries is kept before it is swept (default; `GAUZY_CHAT_DRAFT_UPLOAD_TTL_HOURS`). */
export const CHAT_DRAFT_UPLOAD_TTL_HOURS = 24;
/** The most categories, and channels, one reorder may place. */
export const CHAT_REORDER_MAX_CATEGORIES = 200;
export const CHAT_REORDER_MAX_CHANNELS = 2000;

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
	/** Their position in the organization (e.g. "Frontend Developer"), when one is set. */
	position?: string | null;
	/**
	 * Whether they are here, by the server clock when the list was read: `active` (an app tab reported input lately),
	 * `idle` (a tab is open, but no input for a while, or they set themselves as away) or `offline` (no tab reported
	 * within the presence window). The
	 * realtime channel's `presence.changed` keeps it current after that.
	 */
	presence?: ChatPresenceStatus;
	/** When one of their tabs last reported, or null when none ever did. */
	lastSeenAt?: Date | null;
}

/** A person's presence as the chat shows it (the realtime channel's `away` reads as `idle`). */
export enum ChatPresenceStatus {
	ACTIVE = 'active',
	IDLE = 'idle',
	OFFLINE = 'offline'
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
	/**
	 * Markdown subset with mention tokens; empty for a deleted message (`deletedAt` set) and for a message of files
	 * only (`attachmentIds` not empty).
	 */
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
	/**
	 * The names the attached files had when the message was sent or last edited, one per line: what a message of
	 * files only reads as in a preview, a notification and the search. Null without attachments (and on messages
	 * older than the column).
	 */
	attachmentNames?: string | null;
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
	/** The text; may be empty (or left out) when the message carries at least one attachment. */
	body?: string;
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
	/** The new text; may be empty when the message, after the edit, carries at least one attachment. */
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
	/** A picture's size in pixels as shown (orientation applied), read when it was uploaded; null when unknown. */
	width?: number | null;
	height?: number | null;
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

// ------------------------------------------------------------------ task cards (FR-14)

/**
 * `PATCH /chat/messages/:id/tasks/:taskId`: change a task from its card in a message — its status, its priority, its
 * assignees. Only what is named changes; the change goes through the platform's task update, with the permissions
 * (`ORG_TASK_EDIT`) and the activity log of the task page.
 */
export interface IChatTaskUpdateInput {
	/** The status's name (a board column), as the task page writes it; with `taskStatusId` when the status is a record. */
	status?: string;
	taskStatusId?: ID | null;
	/** The priority's name; with `taskPriorityId` when the priority is a record; null clears it. */
	priority?: string | null;
	taskPriorityId?: ID | null;
	/** The assignees, all of them (an empty list unassigns everyone): employees of the task's organization. */
	assigneeEmployeeIds?: ID[];
}

/** What a change from a task card answers: the task as it is now, and the events the change caused. */
export interface IChatTaskUpdateResult {
	task: ITask;
	events: IChatEvent[];
}

// ------------------------------------------------------------------ typing

/** `POST /chat/conversations/:id/typing`: I am typing in the conversation (or in one of its threads). */
export interface IChatTypingInput {
	/** The thread I am typing in; left out for the conversation itself. */
	threadRootId?: ID;
}

/**
 * What a typing signal answers: whether it was told (a repeat within {@link CHAT_TYPING_MIN_INTERVAL_MS} is not), and
 * how long the members show it ({@link CHAT_TYPING_TTL_MS}). The members hear it as the real-time channel's
 * `typing.signalled` signal; nothing is stored.
 */
export interface IChatTypingResult {
	sent: boolean;
	expiresInMs: number;
}

// ------------------------------------------------------------------ categories

/** The channels of one category in the order the sidebar shows them; `categoryId` null for the uncategorized. */
export interface IChatCategoryChannelOrder {
	categoryId: ID | null;
	conversationIds: ID[];
}

/**
 * `POST /chat/categories/reorder`: the order of the organization's categories (all of them, first to last), and
 * optionally of the channels within them (a channel named under a category moves there). Saved in one transaction.
 */
export interface IChatCategoryReorderInput {
	categoryIds: ID[];
	channels?: IChatCategoryChannelOrder[];
}

export interface IChatCategoryReorderResult {
	/** Every category of the organization, in the new order. */
	categories: IChatCategory[];
	/** The channels whose category or place changed. */
	conversations: Array<{ id: ID; categoryId: ID | null; position: number }>;
	events: IChatEvent[];
}

// ------------------------------------------------------------------ draft uploads

/**
 * `DELETE /chat/attachments/:documentId`: a file I uploaded for a message and will not send. Only a file that no
 * message carries (a draft upload) is discarded — the document and its stored bytes go; a file already sent stays.
 */
export interface IChatDraftDiscardResult {
	discarded: boolean;
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

/**
 * `POST /chat/messages/:id/interactions`: the button clicked. A client sends an `Idempotency-Key` header with it (a
 * new UUID per click, the same on each retry of that click, at most 64 printable characters): a repeat of the key
 * answers the first click as it is now and calls the app no second time. Without the header every request is a click.
 */
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
	/** The `Idempotency-Key` named an earlier click: this is that click as it is now, and nothing was sent again. */
	replayed?: boolean;
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

// ------------------------------------------------------------------ link previews

/** Where a link preview stands (`GET /chat/link-preview?url=`). */
export enum ChatLinkPreviewStatusEnum {
	/** Being fetched in the background: ask again in a couple of seconds. */
	PENDING = 'pending',
	/** Fetched: the fields are what the page says about itself in its `<head>`. */
	READY = 'ready',
	/** No preview: the page is not on a public address, could not be fetched, or says nothing usable. Show the link. */
	UNAVAILABLE = 'unavailable'
}

/** The longest link a preview is asked for. */
export const CHAT_LINK_PREVIEW_URL_MAX_LENGTH = 2048;

/**
 * A link preview, fetched by the server (never by the browser) from a public address and cached. Every string is
 * plain text the server sanitized: render it as text, never as HTML. `image` and `icon` are absolute `https:` URLs.
 */
export interface IChatLinkPreview {
	/** The link the preview is of, normalized (no fragment). */
	url: string;
	status: ChatLinkPreviewStatusEnum;
	title?: string | null;
	description?: string | null;
	siteName?: string | null;
	image?: string | null;
	imageAlt?: string | null;
	imageWidth?: number | null;
	imageHeight?: number | null;
	icon?: string | null;
	/** When the page was last fetched. */
	fetchedAt?: Date | null;
}

/** `GET /chat/link-preview?url=`. */
export interface IChatLinkPreviewQuery {
	url: string;
}
