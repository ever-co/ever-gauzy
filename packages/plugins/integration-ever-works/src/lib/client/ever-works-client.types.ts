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
