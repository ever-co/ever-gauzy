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
 * replay, the error envelope, injected failures and a request log; `GET /members`, `GET /agents`; tasks
 * (`GET`/`POST /tasks`, `GET`/`PATCH`/`DELETE /tasks/:id`, `POST /tasks/:id/transition` with gates,
 * `PUT /tasks/:id/assignees|watchers|blocks|relations`, task comments) and `GET`/`PUT`/`DELETE /links`,
 * each task write bumping the version, honouring `If-Match` and recording its event. Resources are added
 * with the engine.
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

/** One external record link (contract v1 link DTO without its timestamps). */
export interface MockEverWorksLink {
	organizationId: string;
	entityType: string;
	entityId: string;
	source: string;
	installationId: string | null;
	externalId: string;
	externalUrl: string | null;
}

/** What a resource extension of the mock receives for one organization-scoped request. */
export interface MockEverWorksRouteContext {
	method: string;
	path: string;
	query: Record<string, string>;
	body: unknown;
	key: MockEverWorksKey;
	headers: Record<string, string>;
	/** The pinned organization of `X-Scope-Slug` / `X-Organization-Id`, or `null`. */
	org: { id: string; slug: string; displayName: string } | null;
	/** `null` when the key has the scope and the organization is pinned, else the refusal to answer. */
	scoped: (scope: string) => EverWorksHttpResponse | null;
	ok: (data: unknown, status?: number) => EverWorksHttpResponse;
}

/** A resource route of the mock: the answer, or `null` when the request is not its route. */
export type MockEverWorksExtension = (context: MockEverWorksRouteContext) => EverWorksHttpResponse | null;

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
	/** Tasks (contract task DTOs) and their comments, by id. */
	readonly tasks = new Map<string, Record<string, unknown>>();
	readonly comments = new Map<string, Record<string, unknown>>();
	/** External record links (`/links`). */
	readonly links: MockEverWorksLink[] = [];
	/** Statuses a transition may not reach, per task id (its gates): `409 transition_blocked` with these blockers. */
	readonly transitionGates = new Map<string, { blocked: string[]; blockers: Array<Record<string, unknown>> }>();
	readonly requests: MockEverWorksRecordedRequest[] = [];
	readonly deliveries: MockEverWorksDelivery[] = [];
	readonly failures: MockEverWorksFailure[] = [];
	/** Resource routes kept in their own files (`mock-ever-works.resources.ts`); the first answer wins. */
	readonly extensions: MockEverWorksExtension[] = [];
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

	/** Ends the replay window of every `Idempotency-Key` seen so far (Ever Works keeps a key 24 h). */
	expireIdempotencyKeys(): void {
		this.idempotent.clear();
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

		const response = await this.route(request.method, path, recorded.query, request.body, key, headers);
		// Like Ever Works: only a completed create is stored; a refusal releases the key, so a retry can succeed.
		if (replayKey && response.status < 400) this.idempotent.set(replayKey, response);
		return response;
	}

	private route(
		method: string,
		path: string,
		query: Record<string, string>,
		body: unknown,
		key: MockEverWorksKey,
		headers: Record<string, string> = {}
	): EverWorksHttpResponse | Promise<EverWorksHttpResponse> {
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
		for (const extension of this.extensions) {
			const answer = extension({ method, path, query, body, key, headers, org: org ?? null, scoped, ok });
			if (answer) return answer;
		}
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
		if (path === '/tasks' || path.startsWith('/tasks/')) {
			const denied = scoped(method === 'GET' ? 'tasks:read' : 'tasks:write');
			if (denied) return denied;
			return this.taskRoute(method, path, query, body, key, headers, org?.id as string);
		}
		if (path === '/links' || path.startsWith('/links/')) {
			const denied = scoped(method === 'GET' ? 'tasks:read' : 'links:write');
			if (denied) return denied;
			return this.linkRoute(method, path, query, body, key, org?.id as string);
		}
		return MockEverWorksServer.error(404, 'not_found', `No route ${method} ${path}.`);
	}

	/** Adds (or replaces) a task (contract task DTO) and returns it. */
	addTask(organizationId: string, task: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
		const id = (task['id'] as string) ?? randomUUID();
		const now = new Date().toISOString();
		const row: Record<string, unknown> = {
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
			slug: `T-${this.tasks.size + 1}`,
			title: 'A task',
			description: null,
			status: 'backlog',
			priority: 'p3',
			labels: [],
			workId: null,
			missionId: null,
			ideaId: null,
			goalId: null,
			agentId: null,
			parentTaskId: null,
			assignees: [],
			watchers: [],
			approvers: [],
			reviewers: [],
			blockedBy: [],
			relations: [],
			startedAt: null,
			completedAt: null,
			isRecurringTemplate: false,
			hiddenFromBoard: false,
			runtime: { prUrl: null, prState: null, ciState: null, latestRunStatus: null },
			webUrl: `https://app.example.test/tasks/${id}`,
			dueAt: null,
			startAt: null,
			estimateMinutes: null,
			...task
		};
		this.tasks.set(id, row);
		return row;
	}

	/**
	 * Ever Works' sub-task rule: a task agrees with its parent on every owner (work, mission, idea, team — the
	 * first of `teamIds` —, agent, goal), else `400 validation_failed` with Ever Works' own message.
	 */
	static parentScopeRefusal(child: Record<string, unknown>, parent: Record<string, unknown>): EverWorksHttpResponse | null {
		const scopeOf = (task: Record<string, unknown>) => {
			const owners: Record<string, unknown> = { ...task, teamId: ((task['teamIds'] as string[] | null | undefined) ?? [])[0] ?? null };
			const parts = ['workId', 'missionId', 'ideaId', 'teamId', 'agentId', 'goalId'].filter((key) => owners[key]).map((key) => `${key.slice(0, -2)}:${String(owners[key])}`);
			return parts.length ? parts.join('|') : 'unscoped';
		};
		const childScope = scopeOf(child);
		const parentScope = scopeOf(parent);
		return childScope === parentScope
			? null
			: MockEverWorksServer.error(400, 'validation_failed', `Parent Task scope (${parentScope}) must match child Task scope (${childScope}).`);
	}

	/** An `ever-gauzy` key links as `gauzy` (contract v1, CR-1). */
	static linkSource(key: Pick<MockEverWorksKey, 'integrationKind'>): string {
		return key.integrationKind === 'ever-gauzy' ? 'gauzy' : key.integrationKind || 'generic';
	}

	/** The task DTO as served: `externalLinks` filtered to the caller's source. */
	private taskView(task: Record<string, unknown>, key: MockEverWorksKey): Record<string, unknown> {
		const source = MockEverWorksServer.linkSource(key);
		const externalLinks = this.links
			.filter((link) => link.entityType === 'task' && link.entityId === task['id'] && link.source === source)
			.map((link) => ({ source: link.source, installationId: link.installationId, externalId: link.externalId, externalUrl: link.externalUrl }));
		return { ...task, externalLinks };
	}

	/** Bumps a task's version, records its event (with the caller's origin and act-as) and returns the served DTO. */
	private async touch(
		task: Record<string, unknown>,
		type: string,
		key: MockEverWorksKey,
		headers: Record<string, string>,
		changedFields: string[],
		previous: Record<string, unknown> | null = null,
		data?: Record<string, unknown>
	): Promise<Record<string, unknown>> {
		task['version'] = Number(task['version'] ?? 0) + 1;
		task['updatedAt'] = new Date().toISOString();
		const actAs = headers['x-act-as-user'];
		await this.emit({
			type,
			organizationId: task['organizationId'] as string,
			aggregate: { type: 'task', id: task['id'] as string, version: task['version'] as number },
			actor: actAs ? { type: 'user', id: actAs } : { type: 'integration', id: key.keyId, label: key.keyName },
			origin: { tag: headers['x-sync-origin'] ?? null, integrationKeyId: key.keyId },
			changedFields,
			data: data ?? this.taskView(task, key),
			previous
		});
		return this.taskView(task, key);
	}

	/** Contract v1 `/tasks*` (the routes the task sync uses). */
	private async taskRoute(
		method: string,
		path: string,
		query: Record<string, string>,
		body: unknown,
		key: MockEverWorksKey,
		headers: Record<string, string>,
		organizationId: string
	): Promise<EverWorksHttpResponse> {
		const ok = (data: Record<string, unknown> | unknown, status = 200): EverWorksHttpResponse => {
			const version = data && typeof data === 'object' ? (data as Record<string, unknown>)['version'] : undefined;
			return { status, headers: { 'content-type': 'application/json', ...(version !== undefined ? { etag: `"${version}"` } : {}) }, data };
		};
		const input = (body ?? {}) as Record<string, unknown>;
		const parts = path.split('/').filter(Boolean); // ['tasks', id?, sub?, cid?]
		const visible = (task: Record<string, unknown> | undefined): task is Record<string, unknown> =>
			!!task && task['organizationId'] === organizationId && task['visibility'] !== 'private';
		if (parts.length === 1 && method === 'GET') {
			return ok(MockEverWorksServer.page([...this.tasks.values()].filter(visible).map((task) => this.taskView(task, key)), query));
		}
		if (parts.length === 1 && method === 'POST') {
			const title = input['title'];
			if (typeof title !== 'string' || !title || title.length > 200) return MockEverWorksServer.error(400, 'validation_failed', 'title is 1 to 200 characters.');
			if (input['status'] !== undefined && input['status'] !== 'backlog' && input['status'] !== 'todo') {
				return MockEverWorksServer.error(400, 'validation_failed', 'status on create is backlog or todo.');
			}
			if (input['visibility'] === 'private') return MockEverWorksServer.error(422, 'domain_rule', 'An integration cannot create a private record.');
			const ref = input['externalRef'] as { source?: string; installationId?: string | null; externalId?: string; externalUrl?: string | null } | undefined;
			const source = MockEverWorksServer.linkSource(key);
			if (ref && ref.source !== source) return MockEverWorksServer.error(400, 'validation_failed', `externalRef.source must be "${source}", the source of this key`);
			const installationId = ref?.installationId ?? ((headers['x-sync-origin'] ?? '').replace(/^gauzy:/, '') || null);
			const existing = ref
				? this.links.find((link) => link.entityType === 'task' && link.source === source && link.installationId === installationId && link.externalId === ref.externalId)
				: undefined;
			const already = existing ? this.tasks.get(existing.entityId) : undefined;
			if (already) return ok(this.taskView(already, key));
			const fields = { ...input };
			delete fields['externalRef'];
			const teamIds = (fields['teamIds'] as string[] | undefined) ?? [];
			if (typeof fields['parentTaskId'] === 'string') {
				const parent = this.tasks.get(fields['parentTaskId']);
				if (!visible(parent)) return MockEverWorksServer.error(400, 'validation_failed', `Parent Task ${fields['parentTaskId']} not found.`);
				const refused = MockEverWorksServer.parentScopeRefusal(fields, parent);
				if (refused) return refused;
			}
			const task = this.addTask(organizationId, {
				...fields,
				status: (fields['status'] as string | undefined) ?? 'backlog',
				visibility: (fields['visibility'] as string | undefined) ?? (teamIds.length ? 'team' : 'organization'),
				version: 0
			});
			if (ref?.externalId) {
				this.links.push({ organizationId, entityType: 'task', entityId: task['id'] as string, source, installationId, externalId: ref.externalId, externalUrl: ref.externalUrl ?? null });
			}
			return ok(await this.touch(task, 'task.created', key, headers, []), 201);
		}
		const found = this.tasks.get(parts[1] ?? '');
		if (!visible(found)) return MockEverWorksServer.error(404, 'not_found', 'No such task.');
		const row = found;
		const ifMatch = headers['if-match'];
		if (ifMatch && (method === 'PATCH' || method === 'PUT' || method === 'DELETE') && ifMatch !== `"${row['version']}"`) {
			return MockEverWorksServer.error(412, 'version_mismatch', 'The task changed.', { currentVersion: row['version'] });
		}
		if (parts.length === 2 && method === 'GET') return ok(this.taskView(row, key));
		if (parts.length === 2 && method === 'PATCH') {
			if ('status' in input) return MockEverWorksServer.error(400, 'validation_failed', 'status moves through /transition.');
			if (input['visibility'] === 'private') return MockEverWorksServer.error(422, 'domain_rule', 'An integration cannot make a record private.');
			// The parent the task has after this request, checked against the owners it has after it.
			const parentId = 'parentTaskId' in input ? input['parentTaskId'] : row['parentTaskId'];
			const owners = ['parentTaskId', 'workId', 'missionId', 'ideaId', 'teamIds', 'agentId', 'goalId'];
			if (typeof parentId === 'string' && owners.some((field) => field in input)) {
				const parent = this.tasks.get(parentId);
				if (!visible(parent)) return MockEverWorksServer.error(400, 'validation_failed', `Parent Task ${parentId} not found.`);
				const refused = MockEverWorksServer.parentScopeRefusal({ ...row, ...input }, parent);
				if (refused) return refused;
			}
			const previous: Record<string, unknown> = {};
			for (const [field, value] of Object.entries(input)) {
				previous[field] = row[field] ?? null;
				row[field] = value;
			}
			if ('teamIds' in input && !row['visibilityExplicit']) row['visibility'] = ((input['teamIds'] as string[] | null) ?? []).length ? 'team' : 'organization';
			return ok(await this.touch(row, 'task.updated', key, headers, Object.keys(input), previous));
		}
		if (parts.length === 2 && method === 'DELETE') {
			this.tasks.delete(row['id'] as string);
			await this.touch(row, 'task.deleted', key, headers, [], null, { ...this.taskView(row, key), deleted: true });
			return { status: 204, headers: {}, data: undefined };
		}
		if (parts.length === 3 && parts[2] === 'transition' && method === 'POST') {
			const to = input['to'];
			if (input['mode'] !== 'sync' || typeof to !== 'string' || !['backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled'].includes(to)) {
				return MockEverWorksServer.error(400, 'validation_failed', "to is a task status and mode is 'sync'.");
			}
			const gate = this.transitionGates.get(row['id'] as string);
			if (gate?.blocked.includes(to)) {
				return MockEverWorksServer.error(409, 'transition_blocked', `${String(row['slug'])} cannot move to ${to}.`, {
					from: row['status'],
					to,
					blockers: gate.blockers,
					pendingApprovers: [],
					path: [to]
				});
			}
			if (row['status'] === to) return ok(this.taskView(row, key));
			const previous = { status: row['status'] };
			row['status'] = to;
			return ok(await this.touch(row, 'task.transitioned', key, headers, ['status'], previous));
		}
		const sets: Record<string, { field: string; bodyKey: string }> = {
			assignees: { field: 'assignees', bodyKey: 'assignees' },
			watchers: { field: 'watchers', bodyKey: 'userIds' },
			blocks: { field: 'blockedBy', bodyKey: 'blockedBy' },
			relations: { field: 'relations', bodyKey: 'relations' }
		};
		const set = parts.length === 3 && method === 'PUT' ? sets[parts[2] ?? ''] : undefined;
		if (set) {
			const next = input[set.bodyKey];
			if (!Array.isArray(next)) return MockEverWorksServer.error(400, 'validation_failed', `${set.bodyKey} is required.`);
			const previous = { [set.field]: row[set.field] };
			row[set.field] = next;
			return ok(await this.touch(row, 'task.updated', key, headers, [set.field], previous));
		}
		if (parts[2] === 'comments') return this.commentRoute(method, parts, input, key, headers, row);
		return MockEverWorksServer.error(404, 'not_found', `No route ${method} ${path}.`);
	}

	/** Contract v1 task comments (`/tasks/:id/comments[/:cid]`): body ≤ 16384 (CR-2), only the author edits or deletes. */
	private async commentRoute(
		method: string,
		parts: string[],
		input: Record<string, unknown>,
		key: MockEverWorksKey,
		headers: Record<string, string>,
		task: Record<string, unknown>
	): Promise<EverWorksHttpResponse> {
		const ok = (data: unknown, status = 200): EverWorksHttpResponse => ({ status, headers: { 'content-type': 'application/json' }, data });
		const actAs = headers['x-act-as-user'] ?? null;
		if (parts.length === 3 && method === 'GET') {
			return ok({ data: [...this.comments.values()].filter((comment) => comment['taskId'] === task['id']), nextCursor: null, hasMore: false });
		}
		if (parts.length === 3 && method === 'POST') {
			const text = input['body'];
			if (typeof text !== 'string' || !text || text.length > 16384) return MockEverWorksServer.error(400, 'validation_failed', 'body is 1 to 16384 characters.');
			const now = new Date().toISOString();
			const comment: Record<string, unknown> = {
				id: randomUUID(),
				taskId: task['id'],
				organizationId: task['organizationId'],
				authorType: actAs ? 'user' : 'integration',
				authorId: actAs ?? key.keyId,
				externalAuthor: actAs ? null : ((input['externalAuthor'] as Record<string, unknown> | undefined) ?? null),
				body: text,
				mentions: [],
				editedAt: null,
				createdAt: now,
				updatedAt: now,
				externalLinks: []
			};
			this.comments.set(comment['id'] as string, comment);
			await this.touch(task, 'task.comment.created', key, headers, ['comments'], null, comment);
			return ok(comment, 201);
		}
		const comment = this.comments.get(parts[3] ?? '');
		if (!comment || comment['taskId'] !== task['id']) return MockEverWorksServer.error(404, 'not_found', 'No such comment.');
		if (comment['authorId'] !== (actAs ?? key.keyId)) return MockEverWorksServer.error(422, 'domain_rule', 'Only the author edits or deletes a comment.');
		if (parts.length === 4 && method === 'PATCH') {
			const text = input['body'];
			if (typeof text !== 'string' || !text || text.length > 16384) return MockEverWorksServer.error(400, 'validation_failed', 'body is 1 to 16384 characters.');
			const now = new Date().toISOString();
			Object.assign(comment, { body: text, editedAt: now, updatedAt: now });
			await this.touch(task, 'task.comment.updated', key, headers, ['comments'], null, comment);
			return ok(comment);
		}
		if (parts.length === 4 && method === 'DELETE') {
			this.comments.delete(comment['id'] as string);
			await this.touch(task, 'task.comment.deleted', key, headers, ['comments'], null, { ...comment, deleted: true });
			return { status: 204, headers: {}, data: undefined };
		}
		return MockEverWorksServer.error(404, 'not_found', `No route ${method} /tasks/${String(task['id'])}/comments.`);
	}

	/** Contract v1 `/links` (`GET ?entityType=&externalId=`, `PUT`/`DELETE /links/:entityType/:entityId`). */
	private linkRoute(method: string, path: string, query: Record<string, string>, body: unknown, key: MockEverWorksKey, organizationId: string): EverWorksHttpResponse {
		const ok = (data: unknown, status = 200): EverWorksHttpResponse => ({ status, headers: { 'content-type': 'application/json' }, data });
		const stamp = (link: MockEverWorksLink) => ({ ...link, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
		const source = MockEverWorksServer.linkSource(key);
		const parts = path.split('/').filter(Boolean); // ['links', entityType?, entityId?]
		if (parts.length === 1 && method === 'GET') {
			const rows = this.links.filter(
				(link) =>
					link.organizationId === organizationId &&
					link.source === source &&
					(!query['entityType'] || link.entityType === query['entityType']) &&
					(!query['externalId'] || link.externalId === query['externalId'])
			);
			return ok({ data: rows.map(stamp), nextCursor: null, hasMore: false });
		}
		const entityType = parts[1];
		const entityId = parts[2];
		if (parts.length !== 3 || !entityType || !entityId) return MockEverWorksServer.error(404, 'not_found', `No route ${method} ${path}.`);
		if (entityType === 'task' && !this.tasks.has(entityId)) return MockEverWorksServer.error(404, 'not_found', 'No such record.');
		const input = (body ?? {}) as { externalId?: string; externalUrl?: string | null; installationId?: string | null };
		if (method === 'PUT') {
			if (!input.externalId) return MockEverWorksServer.error(400, 'validation_failed', 'externalId is required.');
			const installationId = input.installationId ?? null;
			const row: MockEverWorksLink = { organizationId, entityType, entityId, source, installationId, externalId: input.externalId, externalUrl: input.externalUrl ?? null };
			const at = this.links.findIndex((link) => link.entityType === entityType && link.entityId === entityId && link.source === source && link.installationId === installationId);
			if (at >= 0) this.links.splice(at, 1, row);
			else this.links.push(row);
			return ok(stamp(row));
		}
		if (method === 'DELETE') {
			// Every installation of the caller's source, unless `?installationId=` names one (contract CR-2(3)).
			const installationId = query['installationId'];
			for (let i = this.links.length - 1; i >= 0; i--) {
				const link = this.links[i];
				if (link && link.entityType === entityType && link.entityId === entityId && link.source === source && (!installationId || link.installationId === installationId)) {
					this.links.splice(i, 1);
				}
			}
			return { status: 204, headers: {}, data: undefined };
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
		const [, , , id, action] = path.split('/'); // ['', 'inbox', 'items', id?, action?]
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
