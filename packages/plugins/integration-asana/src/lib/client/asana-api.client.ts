import { ASANA_API_URL } from '../asana.constants';

export interface AsanaWorkspace {
	gid: string;
	name: string;
}

export interface AsanaUser {
	gid: string;
	name: string;
	email: string | null;
	workspaces: AsanaWorkspace[];
}

export interface AsanaProject {
	gid: string;
	name: string;
	archived: boolean;
}

export interface AsanaSection {
	gid: string;
	name: string;
}

export interface AsanaTag {
	gid: string;
	name: string;
	color: string | null;
}

export interface AsanaCustomField {
	gid: string;
	name: string;
	type: string;
	enum_value: { gid: string; name: string } | null;
}

export interface AsanaTask {
	gid: string;
	name: string;
	notes: string | null;
	completed: boolean;
	completed_at: string | null;
	created_at: string;
	modified_at: string;
	/** A calendar date (`YYYY-MM-DD`). */
	due_on: string | null;
	due_at: string | null;
	permalink_url: string | null;
	resource_subtype: string | null;
	assignee: { gid: string; name: string; email: string | null } | null;
	tags: AsanaTag[];
	parent: { gid: string } | null;
	memberships: Array<{ project: { gid: string } | null; section: AsanaSection | null }>;
	custom_fields: AsanaCustomField[];
	/** How many subtasks the task has (they are read apart: a subtask is in the project only when someone added it). */
	num_subtasks?: number;
}

/** A story of a task: here only the comments (`resource_subtype: comment_added`), with who wrote them. */
export interface AsanaStory {
	gid: string;
	resource_subtype: string | null;
	/** The comment as plain text (Asana also has `html_text`, its own markup). */
	text: string | null;
	created_at: string;
	created_by: { gid: string; name: string; email: string | null } | null;
}

/** A file or link on a task: the address that opens it (`view_url` for a hosted file, else the permalink or the download). */
export interface AsanaAttachment {
	gid: string;
	name: string | null;
	download_url: string | null;
	permalink_url: string | null;
	view_url: string | null;
	host: string | null;
	created_at: string;
}

export interface AsanaTaskUpdateInput {
	name?: string;
	notes?: string | null;
	completed?: boolean;
	due_on?: string | null;
}

export interface AsanaWebhook {
	gid: string;
	active: boolean;
	resource: { gid: string } | null;
	target: string | null;
}

/** What Asana answered when a call did not go through (its HTTP status, or an error in the body). */
export class AsanaApiError extends Error {
	constructor(message: string, readonly status: number | null = null, readonly retryAfterSeconds: number | null = null) {
		super(message);
		this.name = 'AsanaApiError';
	}

	/** The token was refused: the connection needs a fresh token, or a person. */
	/** The token was refused (401): the connection needs a person. A 403 is the resource's (the user lacks access to it), not the token's. */
	get isUnauthorized(): boolean {
		return this.status === 401;
	}

	get isForbidden(): boolean {
		return this.status === 403;
	}

	get isRateLimited(): boolean {
		return this.status === 429;
	}

	get isNotFound(): boolean {
		return this.status === 404;
	}
}

/** The OAuth token Asana hands out (the code exchange and the refresh answer the same shape). */
export interface AsanaOAuthToken {
	accessToken: string;
	tokenType: string;
	/** Seconds until the access token expires (Asana: an hour). */
	expiresIn: number | null;
	/** The token that renews the access token (not sent again on a refresh). */
	refreshToken: string | null;
	/** Who the token is, when Asana says (the code exchange does). */
	user: { gid: string; name: string; email: string | null } | null;
}

const TASK_FIELDS = [
	'gid',
	'name',
	'notes',
	'completed',
	'completed_at',
	'created_at',
	'modified_at',
	'due_on',
	'due_at',
	'permalink_url',
	'resource_subtype',
	'assignee.gid',
	'assignee.name',
	'assignee.email',
	'tags.gid',
	'tags.name',
	'tags.color',
	'parent.gid',
	'memberships.project.gid',
	'memberships.section.gid',
	'memberships.section.name',
	'custom_fields.gid',
	'custom_fields.name',
	'custom_fields.type',
	'custom_fields.enum_value.gid',
	'custom_fields.enum_value.name',
	'num_subtasks'
].join(',');

const STORY_FIELDS = 'gid,resource_subtype,text,created_at,created_by.gid,created_by.name,created_by.email';
const ATTACHMENT_FIELDS = 'gid,name,download_url,permalink_url,view_url,host,created_at';
/** How many stories of one task are read at most (every story counts: a long-lived task has many system ones). */
const STORIES_MAX = 2000;
const ATTACHMENTS_MAX = 500;

type FetchLike = (
	input: string,
	init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }
) => Promise<{
	status: number;
	headers: { get(name: string): string | null };
	text(): Promise<string>;
}>;

/** How long one call to Asana may take. */
const CALL_TIMEOUT_MS = 30_000;

function timeoutSignal(ms: number): AbortSignal | undefined {
	return typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(ms) : undefined;
}

/** The seconds to wait that a rate-limited answer names (`Retry-After`); null when unreadable. */
export function retryAfterSecondsOf(headers: { get(name: string): string | null }): number | null {
	const retryAfter = headers.get('Retry-After')?.trim();
	if (retryAfter && /^\d+$/.test(retryAfter)) return Math.max(1, Number(retryAfter));
	return null;
}

export interface AsanaApiClientOptions {
	apiUrl?: string;
	fetchImpl?: FetchLike;
	timeoutMs?: number;
}

/**
 * The slice of Asana's REST API the integration uses, over the platform's own `fetch`: the user and their
 * workspaces, a workspace's projects, a project's sections, the tasks of a project page by page (changed since
 * a watermark), one task, a task update, a section move, a task creation, and the webhooks of a project. A
 * refused token, a rate limit and an API error each surface as an {@link AsanaApiError}.
 */
export class AsanaApiClient {
	private readonly apiUrl: string;
	private readonly fetchImpl: FetchLike;
	private readonly timeoutMs: number;

	constructor(private readonly accessToken: string, options: AsanaApiClientOptions = {}) {
		this.apiUrl = options.apiUrl ?? ASANA_API_URL;
		this.fetchImpl = options.fetchImpl ?? ((globalThis as { fetch: FetchLike }).fetch as FetchLike);
		this.timeoutMs = options.timeoutMs ?? CALL_TIMEOUT_MS;
	}

	/** One call; `data` of the answer. */
	async call<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
		const response = await this.fetchImpl(`${this.apiUrl}${path}`, {
			method,
			headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${this.accessToken}` },
			body: body === undefined ? undefined : JSON.stringify({ data: body }),
			signal: timeoutSignal(this.timeoutMs)
		});
		const text = await response.text();
		if (response.status === 429) {
			throw new AsanaApiError('Asana rate limit reached', 429, retryAfterSecondsOf(response.headers));
		}
		let parsed: { data?: T; errors?: Array<{ message?: string }> } | null = null;
		try {
			parsed = text ? JSON.parse(text) : {};
		} catch {
			parsed = null;
		}
		if (response.status >= 400) {
			throw new AsanaApiError(parsed?.errors?.[0]?.message || `Asana answered HTTP ${response.status}`, response.status);
		}
		if (!parsed) {
			throw new AsanaApiError('Asana answered something that is not JSON', response.status);
		}
		return parsed.data as T;
	}

	/** Every page of a list (`limit` + `offset`), up to `max` items. */
	private async pages<T>(path: string, max: number): Promise<T[]> {
		const items: T[] = [];
		let offset: string | null = null;
		for (;;) {
			const url = offset ? `${path}&offset=${encodeURIComponent(offset)}` : path;
			const response = await this.fetchImpl(`${this.apiUrl}${url}`, {
				method: 'GET',
				headers: { Accept: 'application/json', Authorization: `Bearer ${this.accessToken}` },
				signal: timeoutSignal(this.timeoutMs)
			});
			const text = await response.text();
			if (response.status === 429) throw new AsanaApiError('Asana rate limit reached', 429, retryAfterSecondsOf(response.headers));
			let parsed: { data?: T[]; next_page?: { offset?: string } | null; errors?: Array<{ message?: string }> } | null = null;
			try {
				parsed = JSON.parse(text);
			} catch {
				parsed = null;
			}
			if (response.status >= 400) throw new AsanaApiError(parsed?.errors?.[0]?.message || `Asana answered HTTP ${response.status}`, response.status);
			if (!parsed) throw new AsanaApiError('Asana answered something that is not JSON', response.status);
			items.push(...(parsed.data ?? []));
			const next = parsed.next_page?.offset ?? null;
			if (!next || items.length >= max) break;
			offset = next;
		}
		return items;
	}

	async me(): Promise<AsanaUser> {
		return this.call<AsanaUser>('GET', '/users/me?opt_fields=gid,name,email,workspaces.gid,workspaces.name');
	}

	/** The projects of a workspace the token may see (archived ones included, flagged). */
	async projects(workspaceGid: string): Promise<AsanaProject[]> {
		return this.pages<AsanaProject>(`/workspaces/${encodeURIComponent(workspaceGid)}/projects?opt_fields=gid,name,archived&limit=100`, 2000);
	}

	async sections(projectGid: string): Promise<AsanaSection[]> {
		return this.pages<AsanaSection>(`/projects/${encodeURIComponent(projectGid)}/sections?opt_fields=gid,name&limit=100`, 500);
	}

	/**
	 * One page of a project's tasks (those changed since the watermark when one is given); the next page's
	 * offset comes back with it.
	 */
	async tasks(
		projectGid: string,
		options: { modifiedSince?: string | null; offset?: string | null; limit?: number } = {}
	): Promise<{ items: AsanaTask[]; nextOffset: string | null }> {
		const params = new URLSearchParams({ project: projectGid, opt_fields: TASK_FIELDS, limit: String(options.limit ?? 100) });
		if (options.modifiedSince) params.set('modified_since', options.modifiedSince);
		if (options.offset) params.set('offset', options.offset);
		const response = await this.fetchImpl(`${this.apiUrl}/tasks?${params.toString()}`, {
			method: 'GET',
			headers: { Accept: 'application/json', Authorization: `Bearer ${this.accessToken}` },
			signal: timeoutSignal(this.timeoutMs)
		});
		const text = await response.text();
		if (response.status === 429) throw new AsanaApiError('Asana rate limit reached', 429, retryAfterSecondsOf(response.headers));
		let parsed: { data?: AsanaTask[]; next_page?: { offset?: string } | null; errors?: Array<{ message?: string }> } | null = null;
		try {
			parsed = JSON.parse(text);
		} catch {
			parsed = null;
		}
		if (response.status >= 400) throw new AsanaApiError(parsed?.errors?.[0]?.message || `Asana answered HTTP ${response.status}`, response.status);
		if (!parsed) throw new AsanaApiError('Asana answered something that is not JSON', response.status);
		return { items: parsed.data ?? [], nextOffset: parsed.next_page?.offset ?? null };
	}

	async task(gid: string): Promise<AsanaTask | null> {
		try {
			return await this.call<AsanaTask>('GET', `/tasks/${encodeURIComponent(gid)}?opt_fields=${TASK_FIELDS}`);
		} catch (error) {
			if (error instanceof AsanaApiError && error.isNotFound) return null;
			throw error;
		}
	}

	/** The comments of a task (its stories of subtype `comment_added`), oldest first. */
	async stories(taskGid: string): Promise<AsanaStory[]> {
		const stories = await this.pages<AsanaStory>(`/tasks/${encodeURIComponent(taskGid)}/stories?opt_fields=${STORY_FIELDS}&limit=100`, STORIES_MAX);
		return stories.filter((story) => story.resource_subtype === 'comment_added');
	}

	/** The files and links of a task. */
	async attachments(taskGid: string): Promise<AsanaAttachment[]> {
		return this.pages<AsanaAttachment>(`/tasks/${encodeURIComponent(taskGid)}/attachments?opt_fields=${ATTACHMENT_FIELDS}&limit=100`, ATTACHMENTS_MAX);
	}

	/** The subtasks of a task, in their order (every page; a task with thousands of subtasks is capped). */
	async subtasks(taskGid: string): Promise<AsanaTask[]> {
		return this.pages<AsanaTask>(`/tasks/${encodeURIComponent(taskGid)}/subtasks?opt_fields=${TASK_FIELDS}&limit=100`, 5000);
	}

	async updateTask(gid: string, input: AsanaTaskUpdateInput): Promise<AsanaTask> {
		return this.call<AsanaTask>('PUT', `/tasks/${encodeURIComponent(gid)}?opt_fields=${TASK_FIELDS}`, input);
	}

	/** Moves a task into a section of its project. */
	async moveToSection(sectionGid: string, taskGid: string): Promise<void> {
		await this.call<unknown>('POST', `/sections/${encodeURIComponent(sectionGid)}/addTask`, { task: taskGid });
	}

	async createTask(input: AsanaTaskUpdateInput & { name: string; projectGid: string; sectionGid?: string | null }): Promise<AsanaTask> {
		const { projectGid, sectionGid, ...fields } = input;
		const body: Record<string, unknown> = { ...fields, projects: [projectGid] };
		if (sectionGid) body['memberships'] = [{ project: projectGid, section: sectionGid }];
		return this.call<AsanaTask>('POST', `/tasks?opt_fields=${TASK_FIELDS}`, body);
	}

	/** The webhooks of a workspace that target a resource (Asana lists them per workspace). */
	async webhooks(workspaceGid: string, resourceGid: string): Promise<AsanaWebhook[]> {
		return this.pages<AsanaWebhook>(
			`/webhooks?workspace=${encodeURIComponent(workspaceGid)}&resource=${encodeURIComponent(resourceGid)}&opt_fields=gid,active,resource.gid,target&limit=100`,
			500
		);
	}

	/**
	 * Registers a webhook on a project: Asana calls the target with the handshake before answering, so the
	 * receiver must be reachable now.
	 */
	async createWebhook(resourceGid: string, target: string): Promise<AsanaWebhook> {
		return this.call<AsanaWebhook>('POST', '/webhooks?opt_fields=gid,active,resource.gid,target', {
			resource: resourceGid,
			target,
			filters: [
				{ resource_type: 'task', action: 'added' },
				{ resource_type: 'task', action: 'changed' },
				{ resource_type: 'task', action: 'undeleted' },
				// A comment added or edited, a file attached: delivered with the task they belong to, which is read again.
				{ resource_type: 'story', resource_subtype: 'comment_added', action: 'added' },
				{ resource_type: 'story', resource_subtype: 'comment_added', action: 'changed' },
				{ resource_type: 'attachment', action: 'added' }
			]
		});
	}

	async deleteWebhook(gid: string): Promise<void> {
		try {
			await this.call<unknown>('DELETE', `/webhooks/${encodeURIComponent(gid)}`);
		} catch (error) {
			if (error instanceof AsanaApiError && error.isNotFound) return;
			throw error;
		}
	}
}

/** One form post to Asana's OAuth token endpoint, bounded in time; the token it answers. */
async function postTokenRequest(tokenUrl: string, form: Record<string, string>, fetchImpl: FetchLike, what: string): Promise<AsanaOAuthToken> {
	const response = await fetchImpl(tokenUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
		body: new URLSearchParams(form).toString(),
		signal: timeoutSignal(CALL_TIMEOUT_MS)
	});
	const text = await response.text();
	if (response.status >= 400) {
		throw new AsanaApiError(`Asana refused the ${what} (HTTP ${response.status})`, response.status);
	}
	let parsed: {
		access_token?: string;
		token_type?: string;
		expires_in?: number;
		refresh_token?: string;
		data?: { gid?: string; id?: number; name?: string; email?: string };
	};
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new AsanaApiError(`Asana answered something that is not JSON to the ${what}`, response.status);
	}
	if (!parsed.access_token) {
		throw new AsanaApiError('Asana answered no access token', response.status);
	}
	const data = parsed.data;
	return {
		accessToken: parsed.access_token,
		tokenType: parsed.token_type || 'Bearer',
		expiresIn: typeof parsed.expires_in === 'number' ? parsed.expires_in : null,
		refreshToken: typeof parsed.refresh_token === 'string' && parsed.refresh_token ? parsed.refresh_token : null,
		user: data && (data.gid || data.id) ? { gid: String(data.gid ?? data.id), name: data.name ?? '', email: data.email ?? null } : null
	};
}

/** Exchanges an authorization code for a token at Asana's OAuth endpoint. */
export function exchangeAsanaCode(
	tokenUrl: string,
	input: { code: string; clientId: string; clientSecret: string; redirectUri: string },
	fetchImpl: FetchLike = (globalThis as { fetch: FetchLike }).fetch
): Promise<AsanaOAuthToken> {
	return postTokenRequest(
		tokenUrl,
		{ grant_type: 'authorization_code', client_id: input.clientId, client_secret: input.clientSecret, redirect_uri: input.redirectUri, code: input.code },
		fetchImpl,
		'authorization code'
	);
}

/** Renews an access token with its refresh token (Asana keeps the refresh token). */
export function refreshAsanaToken(
	tokenUrl: string,
	input: { refreshToken: string; clientId: string; clientSecret: string },
	fetchImpl: FetchLike = (globalThis as { fetch: FetchLike }).fetch
): Promise<AsanaOAuthToken> {
	return postTokenRequest(
		tokenUrl,
		{ grant_type: 'refresh_token', client_id: input.clientId, client_secret: input.clientSecret, refresh_token: input.refreshToken },
		fetchImpl,
		'token refresh'
	);
}
