import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import type { EverWorksEventEnvelope, EverWorksWebhookSubscription } from '../client/ever-works-client.types';
import type { EverWorksHttpRequest, EverWorksHttpResponse, EverWorksTransport } from '../client/ever-works-transport';

/**
 * A mock Ever Works integration API (contract v1, plan 03 Part B) for the plugin's tests and local runs.
 * TEST CODE: never imported by the plugin's runtime and not exported from the package entry point.
 *
 * It answers in-process through {@link MockEverWorksServer.transport} (no socket) or over HTTP with
 * {@link MockEverWorksServer.listen}. Implemented so far: `GET /whoami`, `GET /events`, webhooks v2
 * (`/webhooks` create/get/list/patch/delete/rotate-secret) with signed delivery, `Idempotency-Key`
 * replay, the error envelope, injected failures and a request log. Resources are added with the engine.
 */

/** One integration key the mock accepts. */
export interface MockEverWorksKey {
	key: string;
	keyId: string;
	keyName: string;
	scopes: string[];
	organizations: Array<{ id: string; slug: string; displayName: string }>;
	revoked: boolean;
	integrationKind: string;
}

/** A response forced on the next matching request. */
export interface MockEverWorksFailure {
	method?: string;
	path?: string | RegExp;
	status: number;
	body?: unknown;
	headers?: Record<string, string>;
	/** How many matching requests get it (default 1). */
	times?: number;
}

/** A request as the mock received it (the key reduced to its id). */
export interface MockEverWorksRecordedRequest {
	method: string;
	path: string;
	query: Record<string, string>;
	headers: Record<string, string>;
	keyId: string | null;
	body: unknown;
}

/** A delivery the mock made (or would make) to a webhook subscription. */
export interface MockEverWorksDelivery {
	subscriptionId: string;
	url: string;
	headers: Record<string, string>;
	body: string;
	status: number | null;
}

type Webhook = EverWorksWebhookSubscription & { secret: string; keyId: string };

/** The "Ever Gauzy" preset (02 §3: every scope but org:write and email:write), the default of a new key. */
export const MOCK_PRESET_SCOPES = [
	'org:read',
	'members:read',
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
	'events:read',
	'webhooks:manage',
	'links:write'
];

export class MockEverWorksServer {
	readonly tenant: { id: string; slug: string };
	readonly keys = new Map<string, MockEverWorksKey>();
	readonly webhooks = new Map<string, Webhook>();
	readonly events: EverWorksEventEnvelope[] = [];
	/** Organization members and agents (contract DTOs) the org-scoped routes answer from. */
	readonly members: Array<Record<string, unknown>> = [];
	readonly agents = new Map<string, Record<string, unknown>>();
	/** Inbox items (contract `inbox-item.schema.json`, CR-4) the inbox routes answer from. */
	readonly inboxItems = new Map<string, Record<string, unknown>>();
	readonly requests: MockEverWorksRecordedRequest[] = [];
	readonly deliveries: MockEverWorksDelivery[] = [];
	readonly failures: MockEverWorksFailure[] = [];
	apiVersion = '1';
	limits = { readsPerMin: 3000, writesPerMin: 600 };
	/** Delivers a webhook POST; default: nothing is sent (`status: null`). Tests set it to call Gauzy. */
	deliver: (url: string, headers: Record<string, string>, body: string) => Promise<number | null> = async () => null;
	private seq = 0;
	private readonly idempotent = new Map<string, EverWorksHttpResponse>();
	private server: Server | null = null;

	constructor(options: { tenantId?: string; tenantSlug?: string } = {}) {
		this.tenant = { id: options.tenantId ?? randomUUID(), slug: options.tenantSlug ?? 'acme-tenant' };
	}

	// ── Setup ──────────────────────────────────────────────────────────────────────────────────

	/** Adds a key and returns it (`ew_int_…`). */
	addKey(options: Partial<Omit<MockEverWorksKey, 'key' | 'revoked'>> = {}): string {
		const key = `ew_int_${randomBytes(24).toString('base64url')}`;
		this.keys.set(key, {
			key,
			keyId: options.keyId ?? randomUUID(),
			keyName: options.keyName ?? 'Ever Gauzy — test',
			scopes: options.scopes ?? [...MOCK_PRESET_SCOPES],
			organizations: options.organizations ?? [{ id: randomUUID(), slug: 'acme', displayName: 'Acme Inc.' }],
			revoked: false,
			integrationKind: options.integrationKind ?? 'ever-gauzy'
		});
		return key;
	}

	revokeKey(key: string): void {
		const found = this.keys.get(key);
		if (found) {
			found.revoked = true;
			for (const webhook of this.webhooks.values()) if (webhook.keyId === found.keyId) webhook.status = 'disabled';
		}
	}

	/** Forces a response on the next matching request(s). */
	fail(failure: MockEverWorksFailure): void {
		this.failures.push({ times: 1, ...failure });
	}

	/** The newest `seq` (a string, as the contract carries it). */
	get head(): string {
		return String(this.seq);
	}

	/** Appends an event to the feed and delivers it to every matching webhook subscription. */
	async emit(event: Omit<EverWorksEventEnvelope, 'id' | 'seq' | 'tenantId' | 'occurredAt' | 'version'> & Partial<EverWorksEventEnvelope>): Promise<EverWorksEventEnvelope> {
		this.seq += 1;
		const envelope: EverWorksEventEnvelope = {
			...event,
			id: event.id ?? `evt_${randomUUID().replace(/-/g, '')}`,
			seq: String(this.seq),
			version: event.version ?? 1,
			occurredAt: event.occurredAt ?? new Date().toISOString(),
			tenantId: event.tenantId ?? this.tenant.id
		} as EverWorksEventEnvelope;
		this.events.push(envelope);
		for (const webhook of this.webhooks.values()) {
			if (webhook.status !== 'active') continue;
			if (envelope.organizationId && !webhook.organizationIds.includes(envelope.organizationId)) continue;
			if (envelope.origin?.tag && webhook.excludeOriginTags.includes(envelope.origin.tag)) continue;
			if (!webhook.events.some((pattern) => MockEverWorksServer.matches(pattern, envelope.type))) continue;
			const body = JSON.stringify(envelope);
			const t = Math.floor(Date.now() / 1000);
			const headers = {
				'content-type': 'application/json',
				'x-ever-works-event': envelope.type,
				'x-ever-works-event-id': envelope.id,
				'x-ever-works-delivery': randomUUID(),
				'x-ever-works-signature': `t=${t},v1=${createHmac('sha256', webhook.secret).update(`${t}.${body}`).digest('hex')}`
			};
			const status = await this.deliver(webhook.url, headers, body).catch(() => 0);
			this.deliveries.push({ subscriptionId: webhook.id, url: webhook.url, headers, body, status });
		}
		return envelope;
	}

	static matches(pattern: string, type: string): boolean {
		if (pattern === type) return true;
		if (pattern.endsWith('.*')) return type.startsWith(pattern.slice(0, -1)) && type !== 'task.runtime_updated';
		return false;
	}

	// ── Transport ──────────────────────────────────────────────────────────────────────────────

	/** An in-process transport: every request is answered by {@link handle}. */
	transport(): EverWorksTransport {
		return { send: async (request) => this.handle(request) };
	}

	/** Answers one request (contract v1). */
	async handle(request: EverWorksHttpRequest): Promise<EverWorksHttpResponse> {
		const url = new URL(request.url);
		const marker = '/integrations/v1';
		const at = url.pathname.indexOf(marker);
		const path = at >= 0 ? url.pathname.slice(at + marker.length) || '/' : url.pathname;
		const headers = Object.fromEntries(Object.entries(request.headers).map(([k, v]) => [k.toLowerCase(), v]));
		const presented = (headers['authorization'] ?? '').replace(/^Bearer\s+/i, '') || headers['x-api-key'] || '';
		const key = this.keys.get(presented) ?? null;
		const recorded: MockEverWorksRecordedRequest = {
			method: request.method,
			path,
			query: Object.fromEntries(url.searchParams.entries()),
			headers: { ...headers, ...(headers['authorization'] ? { authorization: 'Bearer <redacted>' } : {}) },
			keyId: key?.keyId ?? null,
			body: request.body
		};
		this.requests.push(recorded);

		const forced = this.failures.find(
			(f) => (!f.method || f.method === request.method) && (!f.path || (typeof f.path === 'string' ? f.path === path : f.path.test(path)))
		);
		if (forced) {
			forced.times = (forced.times ?? 1) - 1;
			if (forced.times <= 0) this.failures.splice(this.failures.indexOf(forced), 1);
			return { status: forced.status, headers: forced.headers ?? {}, data: forced.body ?? MockEverWorksServer.error(forced.status, 'internal_error', 'Injected failure.').data };
		}

		if (!key || key.revoked) return MockEverWorksServer.error(401, 'invalid_key', 'The key is invalid or revoked.');

		const idempotencyKey = headers['idempotency-key'];
		const replayKey = idempotencyKey && request.method === 'POST' ? `${key.keyId}:${idempotencyKey}` : null;
		if (replayKey && this.idempotent.has(replayKey)) return this.idempotent.get(replayKey) as EverWorksHttpResponse;

		const response = this.route(request.method, path, recorded.query, request.body, key, headers);
		if (replayKey && response.status < 500) this.idempotent.set(replayKey, response);
		return response;
	}

	private route(method: string, path: string, query: Record<string, string>, body: unknown, key: MockEverWorksKey, headers: Record<string, string> = {}): EverWorksHttpResponse {
		const has = (scope: string) => key.scopes.includes(scope);
		const ok = (data: unknown, status = 200): EverWorksHttpResponse => ({ status, headers: { 'content-type': 'application/json' }, data });
		if (method === 'GET' && path === '/whoami') {
			return ok({
				keyId: key.keyId,
				keyName: key.keyName,
				integrationKind: key.integrationKind,
				tenant: this.tenant,
				organizations: key.organizations,
				scopes: key.scopes,
				apiVersion: this.apiVersion,
				feedHead: this.head,
				limits: this.limits
			});
		}
		if (method === 'GET' && path === '/events') {
			if (!has('events:read')) return MockEverWorksServer.error(403, 'scope_missing', 'events:read is required.');
			const after = BigInt(query['after'] || '0');
			const limit = Math.min(Number(query['limit'] || 200), 1000);
			const types = (query['types'] || '').split(',').filter(Boolean);
			const exclude = query['excludeOrigin'] || null;
			const pinned = new Set(key.organizations.map((org) => org.id));
			const visible = this.events.filter(
				(event) =>
					BigInt(event.seq) > after &&
					(!event.organizationId || pinned.has(event.organizationId)) &&
					(!exclude || event.origin?.tag !== exclude) &&
					(!types.length || types.some((pattern) => MockEverWorksServer.matches(pattern, event.type)))
			);
			const page = visible.slice(0, limit);
			const hasMore = visible.length > limit;
			return ok({ events: page, nextCursor: page.length ? page[page.length - 1].seq : query['after'] || null, hasMore, head: this.head });
		}
		if (path === '/webhooks' || path.startsWith('/webhooks/')) {
			if (!has('webhooks:manage')) return MockEverWorksServer.error(403, 'scope_missing', 'webhooks:manage is required.');
			return this.webhookRoute(method, path, body, key);
		}
		// Organization-scoped resources: X-Scope-Slug (or X-Organization-Id) must name a pinned organization.
		const org = key.organizations.find((o) => o.slug === headers['x-scope-slug'] || o.id === headers['x-organization-id']);
		const scoped = (scope: string): EverWorksHttpResponse | null => {
			if (!has(scope)) return MockEverWorksServer.error(403, 'scope_missing', `${scope} is required.`);
			if (!org) return MockEverWorksServer.error(403, 'org_not_pinned', 'The organization is not pinned to this key.');
			return null;
		};
		if (method === 'GET' && path === '/members') {
			return scoped('members:read') ?? ok(MockEverWorksServer.page(this.members.filter((m) => m['organizationId'] === org?.id), query));
		}
		if (method === 'GET' && path === '/agents') {
			return scoped('agents:read') ?? ok(MockEverWorksServer.page([...this.agents.values()].filter((a) => a['organizationId'] === org?.id), query));
		}
		if (method === 'GET' && path.startsWith('/agents/')) {
			const denied = scoped('agents:read');
			if (denied) return denied;
			const agent = this.agents.get(path.slice('/agents/'.length));
			return agent && agent['organizationId'] === org?.id ? ok(agent) : MockEverWorksServer.error(404, 'not_found', 'No such agent.');
		}
		if (path === '/inbox/items' || path.startsWith('/inbox/items/')) {
			return this.inboxRoute(method, path, query, body, headers, scoped, org?.id ?? null);
		}
		return MockEverWorksServer.error(404, 'not_found', `No route ${method} ${path}.`);
	}

	/**
	 * The inbox routes (P3, CR-4): reads with `inbox:read`; reply and state with `inbox:write`, acting as the
	 * item's recipient (`X-Act-As-User`, else `403 act_as_forbidden`). An answered or archived item refuses a
	 * reply with `409 conflict`. Writes record `inbox.item.answered` / `inbox.item.state_changed`.
	 */
	private inboxRoute(
		method: string,
		path: string,
		query: Record<string, string>,
		body: unknown,
		headers: Record<string, string>,
		scoped: (scope: string) => EverWorksHttpResponse | null,
		organizationId: string | null
	): EverWorksHttpResponse {
		const ok = (data: unknown, status = 200): EverWorksHttpResponse => ({ status, headers: { 'content-type': 'application/json' }, data });
		const [, , id, action] = path.split('/'); // ['', 'inbox', 'items', id?, action?]
		if (method === 'GET' && !id) {
			const denied = scoped('inbox:read');
			if (denied) return denied;
			const rows = [...this.inboxItems.values()].filter(
				(row) =>
					row['organizationId'] === organizationId &&
					(!query['recipientUserId'] || row['recipientUserId'] === query['recipientUserId']) &&
					(query['includeArchived'] === 'true' || row['status'] !== 'archived') &&
					(!query['updatedSince'] || String(row['updatedAt']) >= query['updatedSince'])
			);
			return ok(MockEverWorksServer.page(rows, query));
		}
		const item = id ? this.inboxItems.get(decodeURIComponent(id)) : undefined;
		if (!item || item['organizationId'] !== organizationId) {
			return scoped(method === 'GET' ? 'inbox:read' : 'inbox:write') ?? MockEverWorksServer.error(404, 'not_found', 'No such inbox item.');
		}
		if (method === 'GET' && !action) return scoped('inbox:read') ?? ok(item);
		const denied = scoped('inbox:write');
		if (denied) return denied;
		if (headers['x-act-as-user'] !== item['recipientUserId']) {
			return MockEverWorksServer.error(403, 'act_as_forbidden', 'Only the recipient answers.', { reason: 'not_the_recipient' });
		}
		const input = (body ?? {}) as { text?: string | null; optionId?: string | null; unread?: boolean; archived?: boolean };
		const now = new Date().toISOString();
		if (method === 'POST' && action === 'reply') {
			if (item['status'] !== 'open') return MockEverWorksServer.error(409, 'conflict', 'The item was already answered or archived.');
			const options = (item['options'] as Array<{ id: string }> | null) ?? [];
			if (input.optionId && options.length && !options.some((option) => option.id === input.optionId)) {
				return MockEverWorksServer.error(400, 'validation_failed', 'optionId is not one of the options.');
			}
			Object.assign(item, {
				status: 'answered',
				unread: false,
				answeredAt: now,
				answerText: input.text ?? null,
				answerOptionId: input.optionId ?? null,
				version: Number(item['version']) + 1,
				updatedAt: now
			});
			void this.emitInbox('inbox.item.answered', item);
			const routed = item['kind'] === 'approval' ? (input.optionId === 'reject' ? 'rejected' : 'approved') : 'resumed';
			return ok({ item, routed, restart: item['kind'] === 'question' ? 'resumed' : 'none' });
		}
		if (method === 'PATCH' && action === 'state') {
			if (input.unread === undefined && input.archived === undefined) {
				return MockEverWorksServer.error(400, 'validation_failed', 'State a change: unread or archived.');
			}
			if (input.unread !== undefined) item['unread'] = input.unread;
			if (input.archived !== undefined) item['status'] = input.archived ? 'archived' : item['answeredAt'] ? 'answered' : 'open';
			Object.assign(item, { version: Number(item['version']) + 1, updatedAt: now });
			void this.emitInbox('inbox.item.state_changed', item);
			return ok(item);
		}
		return MockEverWorksServer.error(404, 'not_found', `No route ${method} ${path}.`);
	}

	/** Adds (or replaces) an inbox item (contract DTO) and returns it; `emitInbox` records its event. */
	addInboxItem(organizationId: string, item: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
		const id = (item['id'] as string) ?? randomUUID();
		const now = new Date().toISOString();
		const row = {
			id,
			organizationId,
			version: 1,
			createdAt: now,
			updatedAt: now,
			recipientUserId: randomUUID(),
			kind: 'question',
			title: 'Which pricing tier should the landing page lead with?',
			body: 'The brief lists three tiers but does not say which one to feature.',
			options: [
				{ id: 'pro', label: 'Pro', recommended: true },
				{ id: 'team', label: 'Team' }
			],
			sourceType: 'agent-run',
			status: 'open',
			unread: true,
			answeredAt: null,
			answerText: null,
			answerOptionId: null,
			agentId: null,
			agentRunId: randomUUID(),
			taskId: null,
			workId: null,
			escalationId: null,
			proposalId: null,
			webUrl: `https://app.example.test/inbox?id=${id}`,
			...item
		};
		this.inboxItems.set(id, row);
		return row;
	}

	/** Records an `inbox.item.*` event of an item (its `data` is the item DTO). */
	emitInbox(type: string, item: Record<string, unknown>, origin: EverWorksEventEnvelope['origin'] = null): Promise<EverWorksEventEnvelope> {
		return this.emit({
			type,
			organizationId: item['organizationId'] as string,
			aggregate: { type: 'inbox_item', id: item['id'] as string, version: Number(item['version']) },
			actor: { type: 'user', id: item['recipientUserId'] as string },
			origin,
			data: { ...item }
		});
	}

	/** A list page (B.1): `?cursor=<offset>&limit=` → `{data, nextCursor, hasMore}`. */
	static page<T>(rows: T[], query: Record<string, string>): { data: T[]; nextCursor: string | null; hasMore: boolean } {
		const offset = Number(query['cursor'] || 0);
		const limit = Math.min(Number(query['limit'] || 200), 500);
		const data = rows.slice(offset, offset + limit);
		const hasMore = offset + limit < rows.length;
		return { data, nextCursor: hasMore ? String(offset + limit) : null, hasMore };
	}

	/** Adds an organization member (contract member DTO) and returns it. */
	addMember(organizationId: string, member: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
		const userId = (member['userId'] as string) ?? randomUUID();
		const now = new Date().toISOString();
		const row = {
			organizationId,
			userId,
			username: `user-${userId.slice(0, 6)}`,
			displayName: null,
			email: `${userId.slice(0, 6)}@example.test`,
			emailVerified: true,
			avatarUrl: null,
			role: 'member',
			isActive: true,
			joinedAt: now,
			updatedAt: now,
			everIdSubjects: [],
			...member
		};
		this.members.push(row);
		return row;
	}

	/** Adds (or replaces) an agent (contract agent DTO) and returns it. */
	addAgent(organizationId: string, agent: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
		const id = (agent['id'] as string) ?? randomUUID();
		const now = new Date().toISOString();
		const row = {
			id,
			organizationId,
			version: 1,
			createdAt: now,
			updatedAt: now,
			visibility: 'organization',
			visibilityExplicit: false,
			owner: { type: 'user', id: randomUUID() },
			createdBy: { type: 'user', id: randomUUID(), label: 'owner' },
			externalLinks: [],
			teamIds: [],
			name: 'Builder',
			slug: `agent-${id.slice(0, 6)}`,
			title: 'Builder agent',
			capabilities: 'Ships pull requests.',
			status: 'active',
			scope: 'tenant',
			scopeTargetId: this.tenant.id,
			reportsToAgentId: null,
			avatar: { mode: 'initials', icon: null, url: null },
			modelId: 'claude-opus-5-5',
			lastRunAt: null,
			webUrl: `https://app.example.test/agents/${id}`,
			...agent
		};
		this.agents.set(id, row);
		return row;
	}

	private webhookRoute(method: string, path: string, body: unknown, key: MockEverWorksKey): EverWorksHttpResponse {
		const ok = (data: unknown, status = 200): EverWorksHttpResponse => ({ status, headers: { 'content-type': 'application/json' }, data });
		const parts = path.split('/').filter(Boolean); // ['webhooks', id?, action?]
		const own = [...this.webhooks.values()].filter((webhook) => webhook.keyId === key.keyId);
		const publicView = (webhook: Webhook, withSecret = false): EverWorksWebhookSubscription => {
			const { secret, keyId: _keyId, ...rest } = webhook;
			return withSecret ? { ...rest, secret } : rest;
		};
		if (parts.length === 1 && method === 'GET') return ok({ data: own.map((webhook) => publicView(webhook)), nextCursor: null, hasMore: false });
		if (parts.length === 1 && method === 'POST') {
			const input = (body ?? {}) as { url?: string; events?: string[]; organizationIds?: string[]; excludeOriginTags?: string[]; description?: string | null };
			const pinned = new Set(key.organizations.map((org) => org.id));
			if (!input.url || !Array.isArray(input.events) || !input.events.length || !Array.isArray(input.organizationIds) || !input.organizationIds.length) {
				return MockEverWorksServer.error(400, 'validation_failed', 'url, events and organizationIds are required.');
			}
			if (input.organizationIds.some((id) => !pinned.has(id))) return MockEverWorksServer.error(403, 'org_not_pinned', 'An organization is not pinned to this key.');
			const now = new Date().toISOString();
			const webhook: Webhook = {
				id: randomUUID(),
				url: input.url,
				description: input.description ?? null,
				events: input.events,
				organizationIds: input.organizationIds,
				excludeOriginTags: input.excludeOriginTags ?? [],
				status: 'active',
				version: 2,
				createdAt: now,
				updatedAt: now,
				secret: randomBytes(32).toString('base64url'),
				keyId: key.keyId
			};
			this.webhooks.set(webhook.id, webhook);
			return ok(publicView(webhook, true), 201);
		}
		const webhook = parts[1] ? this.webhooks.get(parts[1]) : undefined;
		if (!webhook || webhook.keyId !== key.keyId) return MockEverWorksServer.error(404, 'not_found', 'No such webhook subscription.');
		if (parts.length === 2 && method === 'GET') return ok(publicView(webhook));
		if (parts.length === 2 && method === 'PATCH') {
			const input = (body ?? {}) as Partial<Pick<Webhook, 'status' | 'events' | 'organizationIds' | 'excludeOriginTags'>>;
			Object.assign(webhook, Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)), {
				updatedAt: new Date().toISOString()
			});
			return ok(publicView(webhook));
		}
		if (parts.length === 2 && method === 'DELETE') {
			this.webhooks.delete(webhook.id);
			return { status: 204, headers: {}, data: undefined };
		}
		if (parts.length === 3 && parts[2] === 'rotate-secret' && method === 'POST') {
			webhook.secret = randomBytes(32).toString('base64url');
			return ok(publicView(webhook, true));
		}
		return MockEverWorksServer.error(404, 'not_found', `No route ${method} ${path}.`);
	}

	/** The contract's error envelope. */
	static error(status: number, code: string, message: string, details?: Record<string, unknown>, headers: Record<string, string> = {}): EverWorksHttpResponse {
		return { status, headers: { 'content-type': 'application/json', ...headers }, data: { error: { code, message, ...(details ? { details } : {}) } } };
	}

	// ── HTTP ───────────────────────────────────────────────────────────────────────────────────

	/** Serves the mock over HTTP on 127.0.0.1 (port 0 = any free port). */
	async listen(port = 0): Promise<{ url: string; close: () => Promise<void> }> {
		this.server = createServer((req, res) => void this.serveHttp(req, res));
		await new Promise<void>((resolve) => (this.server as Server).listen(port, '127.0.0.1', resolve));
		const address = (this.server as Server).address() as AddressInfo;
		return {
			url: `http://127.0.0.1:${address.port}/api`,
			close: () => new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()))
		};
	}

	private async serveHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
		const chunks: Buffer[] = [];
		for await (const chunk of req) chunks.push(chunk as Buffer);
		const raw = Buffer.concat(chunks).toString('utf8');
		let body: unknown = undefined;
		try {
			body = raw ? JSON.parse(raw) : undefined;
		} catch {
			body = raw;
		}
		const headers: Record<string, string> = {};
		for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers[k] = v;
		const response = await this.handle({
			method: (req.method ?? 'GET') as EverWorksHttpRequest['method'],
			url: `http://${req.headers.host ?? '127.0.0.1'}${req.url ?? '/'}`,
			headers,
			body,
			timeoutMs: 0
		});
		res.writeHead(response.status, response.headers);
		res.end(response.data === undefined ? undefined : JSON.stringify(response.data));
	}

	/** A stable digest of a value (tests compare request bodies with it). */
	static digest(value: unknown): string {
		return createHash('sha256').update(JSON.stringify(value)).digest('hex');
	}
}
