/**
 * The Ever Works integration contract v1 as this plugin consumes it (plan 03 Part B; machine-readable
 * schemas in ever-works `docs/specs/features/integrations-api-v1/contract/`). Consumers ignore unknown
 * properties: v1 grows additively.
 */

/** Scope vocabulary v1 (plan 02 §3). */
export const EVER_WORKS_SCOPES = [
	'org:read',
	'org:write',
	'members:read',
	'members:write',
	'agents:read',
	'teams:read',
	'teams:write',
	'works:read',
	'works:write',
	'missions:read',
	'missions:write',
	'goals:read',
	'goals:write',
	'ideas:read',
	'ideas:write',
	'tasks:read',
	'tasks:write',
	'inbox:read',
	'inbox:write',
	'kb:read',
	'kb:write',
	'email:read',
	'email:write',
	'events:read',
	'webhooks:manage',
	'links:write'
] as const;

export type EverWorksScope = (typeof EVER_WORKS_SCOPES)[number];

/**
 * The "Ever Gauzy" preset: every scope except `org:write` and `email:write`, which are opt-in when the
 * key is created (plan 02 §3). A key without some of these still connects; the missing ones are listed
 * so the admin can create a key with the preset.
 */
export const EVER_GAUZY_PRESET_SCOPES: ReadonlyArray<EverWorksScope> = EVER_WORKS_SCOPES.filter(
	(scope) => scope !== 'org:write' && scope !== 'email:write'
);

/** The scopes the connection itself cannot work without: identity, the change feed and its webhook. */
export const EVER_WORKS_REQUIRED_SCOPES: ReadonlyArray<EverWorksScope> = ['events:read', 'webhooks:manage'];

/** `GET /whoami`. */
export interface EverWorksWhoami {
	keyId: string;
	keyName: string;
	integrationKind?: string;
	tenant: { id: string; slug: string };
	organizations: Array<{ id: string; slug: string; displayName: string }>;
	scopes: string[];
	apiVersion: string;
	feedHead: string;
	limits: { readsPerMin: number; writesPerMin: number };
}

/** The error envelope of every non-2xx response (B.1). */
export interface EverWorksErrorBody {
	error: { code: string; message: string; details?: Record<string, unknown> };
}

/** `POST /webhooks` body (B.5). */
export interface EverWorksCreateWebhook {
	url: string;
	events: string[];
	organizationIds: string[];
	excludeOriginTags?: string[];
	description?: string | null;
}

/** A webhook v2 subscription (B.5). `secret` only in the create and rotate-secret responses. */
export interface EverWorksWebhookSubscription {
	id: string;
	url: string;
	description?: string | null;
	events: string[];
	organizationIds: string[];
	excludeOriginTags: string[];
	status: 'active' | 'paused' | 'failed' | 'disabled';
	version: 2;
	secret?: string;
	createdAt: string;
	updatedAt: string;
}

/** The event envelope shared by the feed, webhooks v2 and EW plugins (B.3). */
export interface EverWorksEventEnvelope<TData = Record<string, unknown>> {
	id: string;
	seq: string;
	type: string;
	version: number;
	occurredAt: string;
	tenantId: string;
	organizationId: string | null;
	aggregate: { type: string; id: string; version: number };
	actor: { type: 'user' | 'agent' | 'integration' | 'system'; id: string | null; label?: string | null };
	origin?: { tag: string | null; integrationKeyId?: string | null } | null;
	changedFields?: string[];
	data: TData;
	previous?: Record<string, unknown> | null;
}

/** `GET /events` (B.2). */
export interface EverWorksEventsPage {
	events: EverWorksEventEnvelope[];
	nextCursor: string | null;
	hasMore: boolean;
	head: string;
}

/** A list page (B.1). */
export interface EverWorksListPage<T> {
	data: T[];
	nextCursor: string | null;
	hasMore: boolean;
}

/** An option of an inbox item: its `id` is sent back as the reply's `optionId` (P3, `inbox-item.schema.json`). */
export interface EverWorksInboxItemOption {
	id: string;
	label: string;
	description?: string;
	recommended?: boolean;
}

/**
 * An Ever Works inbox item (P3, CR-4, `resources/inbox-item.schema.json`): one message addressed to ONE human,
 * its recipient. Not a ResourceBase (no visibility, owner or links): keyed by its id. Also the `data` of the
 * `inbox.item.*` events, which Ever Works serves only to a key holding `inbox:read` (recipient-scoped).
 */
export interface EverWorksInboxItem {
	id: string;
	organizationId: string | null;
	version: number;
	createdAt: string;
	updatedAt: string;
	recipientUserId: string;
	kind: 'question' | 'approval' | 'escalation' | 'notice' | string;
	title: string;
	body: string;
	options: EverWorksInboxItemOption[] | null;
	/** Which producer filed it: an open set (`agent-run`, `fleet-run`, `escalation`, `proposal`, `system`, `work`, …). */
	sourceType: string;
	status: 'open' | 'answered' | 'archived' | string;
	unread: boolean;
	answeredAt: string | null;
	answerText: string | null;
	answerOptionId: string | null;
	agentId: string | null;
	agentRunId: string | null;
	taskId: string | null;
	workId: string | null;
	escalationId: string | null;
	proposalId: string | null;
	webUrl?: string | null;
	/** Only on `inbox.item.deleted`. */
	deleted?: true;
}

/** `POST /inbox/items/:id/reply` (CR-4, `resources/inbox-reply-result.schema.json`). */
export interface EverWorksInboxReplyResult {
	/** The item after the answer (with the winning answer when `routed` is `already-decided`). */
	item: EverWorksInboxItem;
	/** What happened to the record behind it: `steered`, `resumed`, `approved`, `rejected`, `already-decided`, … (open set). */
	routed: string;
	/** What happened to the run behind it: `injected`, `resumed`, `queued`, `failed`, `none` (open set). */
	restart: string;
	runId?: string;
}

/** The longest reply text Ever Works takes (`requests.schema.json` `InboxReply`). */
export const EVER_WORKS_INBOX_REPLY_MAX = 8000;

/** The kind of an inbox item an integration files (`POST /inbox/items`, contract v1 inbox write). */
export type EverWorksInboxWriteKind = 'notice' | 'question' | 'approval' | 'mention' | 'assignment' | 'email' | 'other';

/** The state of an inbox item an integration filed (`PATCH /inbox/items/:id`). */
export type EverWorksInboxWriteState = 'open' | 'resolved' | 'archived';

/** The limits of the inbox write (`POST`/`PATCH /inbox/items`). */
export const EVER_WORKS_INBOX_WRITE_LIMITS = { externalId: 128, title: 300, body: 20_000, choices: 10 } as const;

/** `POST /inbox/items` (scope `inbox:write`): an item an integration files for one Ever Works user. */
export interface EverWorksInboxItemCreate {
	/** The integration's own id of the item (a replay with the same id answers the item already filed). */
	externalId: string;
	recipientUserId: string;
	kind: EverWorksInboxWriteKind;
	title: string;
	/** Markdown. */
	body: string;
	sourceUrl?: string;
	sourceLabel?: string;
	/** Ever Works records the item is about (only those the integration has paired). */
	related?: { taskId?: string; workId?: string; goalId?: string };
	/** For kind `email`. */
	email?: { from: string; to?: string[]; subject: string; receivedAt: string };
	/** For kinds `question` and `approval`. */
	choices?: Array<{ id: string; label: string }>;
	occurredAt?: string;
}

/** `PATCH /inbox/items/:id` with `If-Match` (only items the key filed). */
export interface EverWorksInboxItemPatch {
	title?: string;
	body?: string;
	choices?: Array<{ id: string; label: string }>;
	state?: EverWorksInboxWriteState;
	resolution?: { choiceId?: string; text?: string };
}

/**
 * An inbox item an integration filed, as `POST`/`PATCH /inbox/items` answer it and as its `inbox.item.*` events carry
 * it: the inbox item DTO plus the write's own fields (each optional: v1 grows additively, and a field this plugin does
 * not see is read from the DTO's own `status` / `answer*` fields).
 */
export interface EverWorksFiledInboxItem extends Partial<Omit<EverWorksInboxItem, 'id' | 'version'>> {
	id: string;
	version: number;
	/** `integration` for an item a key filed (`platform` for Ever Works' own), and the key that filed it (CR-15). */
	origin?: 'integration' | 'platform' | string | null;
	integrationKeyId?: string | null;
	externalId?: string | null;
	state?: EverWorksInboxWriteState | string | null;
	resolution?: { choiceId?: string | null; text?: string | null } | null;
	choices?: Array<{ id: string; label: string }> | null;
}

/** One agent email (contract `email-message.schema.json`, CR-11), the fields the Gauzy bridge reads. */
export interface EverWorksEmailMessage {
	id: string;
	organizationId: string | null;
	version: number;
	createdAt: string;
	updatedAt: string;
	ownerUserId: string | null;
	agentId: string | null;
	taskId: string | null;
	conversationId: string | null;
	direction: 'inbound' | 'outbound' | string;
	status: string;
	deliveryStatus?: string | null;
	from: string | null;
	to: string[];
	cc: string[];
	subject: string | null;
	text: string | null;
	html: string | null;
	messageId: string | null;
	inReplyTo: string | null;
	references: string[];
	attachments: Array<{ filename: string; contentType: string; url?: string | null; size?: number | null }>;
	sentAt: string | null;
	receivedAt: string | null;
	webUrl?: string | null;
	/** Set on an event whose body went over 256 KiB (`text`/`html` are `null` then). */
	bodyOmitted?: boolean;
}

/** `POST /email/inbound` (`InboundEmail`, CR-11): a mail a Gauzy mailbox received, for an agent of the pinned org. */
export interface EverWorksInboundEmail {
	agentId: string;
	message: {
		from: string;
		to: string[];
		cc?: string[];
		subject: string;
		text?: string | null;
		html?: string | null;
		messageId?: string | null;
		inReplyTo?: string | null;
		references?: string[];
		attachments?: Array<{ filename: string; contentType: string; url?: string | null }>;
	};
}

/** The answer of `POST /email/inbound` (`email-inbound-result.schema.json`): the stored message and its dispatch. */
export interface EverWorksInboundEmailResult {
	message: EverWorksEmailMessage;
	dispatch: { mode: 'task-spawn' | 'conversation' | string; taskId: string | null; conversationId: string | null; threaded: boolean };
}
