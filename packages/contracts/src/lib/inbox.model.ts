import { BaseEntityEnum, IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

/**
 * The Gauzy Inbox (`@gauzy/plugin-inbox`, plan 04 §2–4): one place for everything addressed to a user —
 * questions, approvals and escalations that wait for them, notices, and (later) email. Each item has one
 * recipient row per user it is addressed to, which carries that user's own read / archive / snooze state.
 */

/** What an inbox item asks of its recipient. */
export enum InboxItemKindEnum {
	/** A question with options and / or a free-text answer. */
	QUESTION = 'QUESTION',
	/** Approve or reject, with a note. */
	APPROVAL = 'APPROVAL',
	/** A decision an agent or a process could not take on its own. */
	ESCALATION = 'ESCALATION',
	/** Read-only information. */
	NOTICE = 'NOTICE',
	/** An email of one of my mailboxes (plan 04 §5, P4). */
	EMAIL = 'EMAIL'
}

/** The kinds that wait for a decision of the recipient ("Decisions" tab). */
export const INBOX_DECISION_KINDS: readonly InboxItemKindEnum[] = [
	InboxItemKindEnum.QUESTION,
	InboxItemKindEnum.APPROVAL,
	InboxItemKindEnum.ESCALATION
];

/** Where an inbox item comes from. A source handler registered for the source receives its replies. */
export enum InboxItemSourceEnum {
	EVER_WORKS = 'EVER_WORKS',
	EMAIL = 'EMAIL',
	GAUZY = 'GAUZY',
	SYSTEM = 'SYSTEM'
}

/** The state of the item itself (shared by its recipients). */
export enum InboxItemStatusEnum {
	OPEN = 'OPEN',
	ANSWERED = 'ANSWERED',
	RESOLVED = 'RESOLVED',
	CANCELLED = 'CANCELLED'
}

export enum InboxItemPriorityEnum {
	LOW = 'low',
	NORMAL = 'normal',
	HIGH = 'high',
	URGENT = 'urgent'
}

export enum InboxItemBodyFormatEnum {
	PLAIN = 'plain',
	MARKDOWN = 'markdown'
}

/** The inbox tabs the API filters on (the Notifications tab reads `/employee-notification` instead). */
export enum InboxTabEnum {
	ALL = 'all',
	DECISIONS = 'decisions',
	EMAIL = 'email',
	/** My items snoozed until a time still to come (hidden from the other tabs until then). */
	SNOOZED = 'snoozed',
	ARCHIVED = 'archived'
}

/** One option of a QUESTION (or an APPROVAL / ESCALATION that offers choices). */
export interface IInboxItemOption {
	id: string;
	label: string;
	description?: string;
	/** Highlighted in the reply pane. */
	recommended?: boolean;
}

/** The answer an item received, and where the source routed it. */
export interface IInboxItemResponse {
	text?: string | null;
	optionId?: string | null;
	answeredByUserId: ID;
	answeredAt: Date | string;
	/** What the source handler did with the reply (for example "resumed the agent run"); `local` without one. */
	routed?: string | null;
}

/** An inbox item, as the API answers it. JSON columns are parsed. */
export interface IInboxItem extends IBasePerTenantAndOrganizationEntityModel {
	kind: InboxItemKindEnum;
	source: InboxItemSourceEnum | string;
	status: InboxItemStatusEnum;
	title: string;
	body?: string | null;
	bodyFormat: InboxItemBodyFormatEnum;
	options?: IInboxItemOption[] | null;
	requireReason?: boolean;
	response?: IInboxItemResponse | null;
	priority: InboxItemPriorityEnum;
	dueAt?: Date | null;
	/** The primary link (a task, a project, an agent, …). */
	entity?: BaseEntityEnum | string | null;
	entityId?: ID | null;
	taskId?: ID | null;
	projectId?: ID | null;
	agentEmployeeId?: ID | null;
	/** EMAIL items (P4). */
	mailboxId?: ID | null;
	emailId?: ID | null;
	/** The item's identity in its source; unique per tenant when set. */
	externalSource?: string | null;
	externalId?: string | null;
	metadata?: Record<string, unknown> | null;
}

/** One recipient's own state of an item. */
export interface IInboxItemRecipient extends IBasePerTenantAndOrganizationEntityModel {
	inboxItemId: ID;
	userId: ID;
	isRead: boolean;
	readAt?: Date | null;
	/** `isArchived` / `archivedAt` (the base columns) are this recipient's archive state. */
	snoozedUntil?: Date | null;
	deliveredAt?: Date | null;
}

/** An item with the caller's own recipient state (the list and detail answers). */
export interface IInboxItemWithState extends IInboxItem {
	recipient: Pick<IInboxItemRecipient, 'isRead' | 'readAt' | 'isArchived' | 'archivedAt' | 'snoozedUntil'> | null;
}

/** `GET /inbox/items` filters. */
export interface IInboxItemFindInput {
	tab?: InboxTabEnum;
	kind?: InboxItemKindEnum;
	source?: string;
	mailboxId?: ID;
	unread?: boolean;
	q?: string;
	projectId?: ID;
	taskId?: ID;
	agentEmployeeId?: ID;
	/** Opaque, from the previous page's `nextCursor`. */
	cursor?: string;
	limit?: number;
}

/** A page of the caller's inbox items. */
export interface IInboxItemPage {
	items: IInboxItemWithState[];
	/** Pass back as `cursor` for the next page; `null` on the last page. */
	nextCursor: string | null;
}

/** `GET /inbox/items/counts`. */
export interface IInboxItemCounts {
	unread: number;
	decisionsOpen: number;
	byMailbox: Array<{ mailboxId: ID; unread: number }>;
}

/** `POST /inbox/items/:id/reply`. */
export interface IInboxReplyInput {
	text?: string;
	optionId?: string;
}

/** `PATCH /inbox/items/:id/state`. */
export interface IInboxRecipientStateInput {
	isRead?: boolean;
	isArchived?: boolean;
	/** ISO date-time; `null` un-snoozes. */
	snoozedUntil?: Date | string | null;
}

/** One recipient of an item a source creates, with the state it already has there (if any). */
export interface IInboxRecipientInput {
	userId: ID;
	isRead?: boolean;
	isArchived?: boolean;
}

/**
 * An item a source (an integration, the platform) creates or updates: `InboxService.upsertExternal`. On an
 * update (the same external identity again), only the fields stated here change; a field left out keeps its
 * value. `kind`, `title` and `recipients` are always stated.
 */
export interface IInboxItemUpsertInput {
	tenantId: ID;
	organizationId?: ID | null;
	kind: InboxItemKindEnum;
	source: InboxItemSourceEnum | string;
	title: string;
	body?: string | null;
	bodyFormat?: InboxItemBodyFormatEnum;
	options?: IInboxItemOption[] | null;
	requireReason?: boolean;
	status?: InboxItemStatusEnum;
	response?: IInboxItemResponse | null;
	priority?: InboxItemPriorityEnum;
	dueAt?: Date | string | null;
	entity?: BaseEntityEnum | string | null;
	entityId?: ID | null;
	taskId?: ID | null;
	projectId?: ID | null;
	agentEmployeeId?: ID | null;
	/** EMAIL items (P4): the mailbox and the stored message. */
	mailboxId?: ID | null;
	emailId?: ID | null;
	metadata?: Record<string, unknown> | null;
	/** The item's identity in its source (`upsertExternal` requires both). */
	externalSource?: string;
	externalId?: string;
	recipients: IInboxRecipientInput[];
}

/** What `InboxService.upsertExternal` / `create` did. */
export interface IInboxItemUpsertResult {
	item: IInboxItem;
	/** `false` when an item with the same external identity existed and was updated. */
	created: boolean;
	/** The recipients the item is addressed to (new and existing). */
	recipientUserIds: ID[];
	/** The stated recipients that are not users of the item's tenant (left out). */
	skippedUserIds: ID[];
}

/** What a source did with a reply (`IInboxSourceHandler.onReply`). */
export interface IInboxSourceReplyResult {
	/** What the source did with the reply (for example "resumed the agent run"); stored as `response.routed`. */
	routed: string;
	/**
	 * The answer the source holds, when it is not the reply that was sent: another answer won the race there
	 * (for example `routed: 'already-decided'`). The inbox then records this answer instead of the caller's.
	 */
	response?: { text?: string | null; optionId?: string | null; answeredAt?: Date | string | null } | null;
}

/**
 * A source of inbox items that acts on their replies — the Ever Works integration registers `EVER_WORKS`
 * (plan 04 §4). The inbox calls `onReply` synchronously, so the source's own refusal (for example
 * "already decided in Ever Works") reaches the user; a thrown `HttpException` is answered as it is.
 */
export interface IInboxSourceHandler {
	readonly source: InboxItemSourceEnum | string;
	onReply(
		item: IInboxItem,
		reply: IInboxReplyInput,
		actor: { id: ID; tenantId?: ID }
	): Promise<IInboxSourceReplyResult>;
	/** Read / unread / archive / snooze of one recipient (best effort: a failure is logged, the state stays). */
	onStateChange?(item: IInboxItem, recipient: IInboxItemRecipient, change: IInboxRecipientStateInput): Promise<void>;
}

/** The registry the sources register with, at bootstrap. */
export interface IInboxSourceHandlerRegistry {
	register(handler: IInboxSourceHandler): void;
	unregister(source: string): void;
	get(source: string): IInboxSourceHandler | undefined;
}

/** What other plugins call to put items into the inbox (no dependency on `@gauzy/plugin-inbox` needed). */
export interface IInboxItemWriter {
	upsertExternal(input: IInboxItemUpsertInput): Promise<IInboxItemUpsertResult>;
	create(input: IInboxItemUpsertInput): Promise<IInboxItemUpsertResult>;
}

/**
 * Injection tokens `@gauzy/plugin-inbox` provides when it is loaded. A plugin that feeds the inbox injects them
 * with `@Optional() @Inject(…)`: when the inbox is off (the default), they are simply absent.
 */
export const INBOX_SOURCE_HANDLER_REGISTRY = 'INBOX_SOURCE_HANDLER_REGISTRY';
export const INBOX_ITEM_WRITER = 'INBOX_ITEM_WRITER';
