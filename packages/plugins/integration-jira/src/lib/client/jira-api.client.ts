// cspell:ignore issuetype issuelinks duedate Cloners duplicat
import { JIRA_API_GATEWAY_URL, JIRA_ISSUES_PAGE_SIZE, JIRA_REQUIRED_SITE_SCOPE } from '../jira.constants';
import { AdfDocument } from '../sync/jira-adf';

/** The three status categories every Jira status belongs to; a mapping names a task status for each. */
export type JiraStatusCategoryKey = 'new' | 'indeterminate' | 'done';

export const JIRA_STATUS_CATEGORIES: readonly JiraStatusCategoryKey[] = ['new', 'indeterminate', 'done'];

/** A Jira Cloud site the token may reach (`accessible-resources`). */
export interface JiraSite {
	/** The cloud id: the site's key on the API gateway. */
	id: string;
	url: string;
	name: string;
	scopes: string[];
	avatarUrl?: string | null;
}

export interface JiraMyself {
	accountId: string;
	displayName: string | null;
	emailAddress: string | null;
}

export interface JiraProject {
	id: string;
	key: string;
	name: string;
	projectTypeKey?: string | null;
	/** Team-managed (`next-gen`) or company-managed (`classic`). */
	style?: string | null;
}

export interface JiraIssueType {
	id: string;
	name: string;
	subtask: boolean;
	hierarchyLevel?: number | null;
}

export interface JiraStatusCategory {
	id?: number;
	key: JiraStatusCategoryKey | string;
	name?: string;
}

export interface JiraStatus {
	id: string;
	name: string;
	statusCategory: JiraStatusCategory;
}

export interface JiraPriority {
	id: string;
	name: string;
}

export interface JiraUser {
	accountId: string;
	displayName?: string | null;
	/** Hidden by the person's privacy settings unless they share it. */
	emailAddress?: string | null;
	accountType?: string | null;
}

export interface JiraComment {
	id: string;
	/** Atlassian Document Format (API v3). */
	body: AdfDocument | null;
	created: string;
	updated: string;
	author: JiraUser | null;
}

export interface JiraAttachment {
	id: string;
	filename: string | null;
	/** The address that opens the file (signed in to the site). */
	content: string | null;
	mimeType?: string | null;
	size?: number | null;
}

/** A link between two issues; the issue it is read from is the other end. */
export interface JiraIssueLink {
	id: string;
	type: { id?: string; name: string; inward: string; outward: string };
	inwardIssue?: { id: string; key: string } | null;
	outwardIssue?: { id: string; key: string } | null;
}

export interface JiraIssueFields {
	summary: string | null;
	description: AdfDocument | null;
	status: JiraStatus | null;
	priority: JiraPriority | null;
	assignee: JiraUser | null;
	labels: string[] | null;
	/** A calendar date (`YYYY-MM-DD`). */
	duedate: string | null;
	parent?: { id: string; key: string } | null;
	issuetype: JiraIssueType | null;
	issuelinks?: JiraIssueLink[] | null;
	project: { id: string; key: string; name?: string } | null;
	created: string;
	updated: string;
	comment?: { comments: JiraComment[]; total?: number } | null;
	attachment?: JiraAttachment[] | null;
}

export interface JiraIssue {
	id: string;
	key: string;
	self?: string;
	fields: JiraIssueFields;
}

/** A transition the issue can take now, and the status it leads to. */
export interface JiraTransition {
	id: string;
	name: string;
	to: JiraStatus;
	isAvailable?: boolean;
	hasScreen?: boolean;
}

/** The fields a task sends to its issue (the edit endpoint takes them as they are). */
export interface JiraIssueFieldsUpdate {
	summary?: string;
	description?: AdfDocument | null;
	priority?: { id: string } | null;
	duedate?: string | null;
	labels?: string[];
}

export interface JiraIssueCreateInput extends JiraIssueFieldsUpdate {
	project: { id: string };
	issuetype: { id: string };
	summary: string;
	parent?: { id: string };
}

export interface JiraWebhookRegistration {
	createdWebhookId?: number | string | null;
	errors?: string[] | null;
}

/** What Jira answered when a call did not go through (its HTTP status and messages). */
export class JiraApiError extends Error {
	constructor(message: string, readonly status: number | null = null, readonly retryAfterSeconds: number | null = null) {
		super(message);
		this.name = 'JiraApiError';
	}

	/** The token was refused (401): the connection needs a fresh token, or a person. A 403 is the resource's, not the token's. */
	get isUnauthorized(): boolean {
		return this.status === 401;
	}

	get isForbidden(): boolean {
		return this.status === 403;
	}

	get isNotFound(): boolean {
		return this.status === 404;
	}

	get isRateLimited(): boolean {
		return this.status === 429;
	}
}

/** The OAuth token Atlassian hands out (the code exchange and the refresh answer the same shape). */
export interface JiraOAuthToken {
	accessToken: string;
	tokenType: string;
	/** Seconds until the access token expires (an hour), when Atlassian says. */
	expiresIn: number | null;
	scope: string | null;
	/** The token that renews the access token (rotating: every renewal answers a new one and spends the old). */
	refreshToken: string | null;
}

type FetchLike = (
	input: string,
	init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }
) => Promise<{
	status: number;
	headers: { get(name: string): string | null };
	text(): Promise<string>;
}>;

/** How long one call to Atlassian may take. */
const CALL_TIMEOUT_MS = 30_000;

/** The issue fields an import, a webhook and an outbound push read. */
export const JIRA_ISSUE_FIELDS = [
	'summary',
	'description',
	'status',
	'priority',
	'assignee',
	'labels',
	'duedate',
	'parent',
	'issuetype',
	'issuelinks',
	'project',
	'created',
	'updated',
	'comment',
	'attachment'
];

function timeoutSignal(ms: number): AbortSignal | undefined {
	return typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(ms) : undefined;
}

/** The seconds to wait that a rate-limited answer names (`Retry-After`, seconds); null when it is not readable. */
export function retryAfterSecondsOf(headers: { get(name: string): string | null }): number | null {
	const retryAfter = headers.get('Retry-After')?.trim();
	if (retryAfter && /^\d+$/.test(retryAfter)) return Math.max(1, Number(retryAfter));
	return null;
}

/** The messages of a Jira error answer (`errorMessages`, `errors`, or an OAuth `error_description`). */
export function errorMessageOf(body: unknown, fallback: string): string {
	if (!body || typeof body !== 'object') return fallback;
	const value = body as { errorMessages?: unknown; errors?: unknown; message?: unknown; error_description?: unknown; error?: unknown };
	const messages: string[] = [];
	if (Array.isArray(value.errorMessages)) messages.push(...value.errorMessages.filter((item): item is string => typeof item === 'string'));
	if (value.errors && typeof value.errors === 'object' && !Array.isArray(value.errors)) {
		for (const [field, message] of Object.entries(value.errors as Record<string, unknown>)) {
			if (typeof message === 'string') messages.push(`${field}: ${message}`);
		}
	}
	if (typeof value.message === 'string') messages.push(value.message);
	if (typeof value.error_description === 'string') messages.push(value.error_description);
	else if (typeof value.error === 'string') messages.push(value.error);
	return messages.length ? messages.join('; ').slice(0, 500) : fallback;
}

export interface JiraApiClientOptions {
	/** The API gateway (`https://api.atlassian.com` by default). */
	apiUrl?: string;
	tokenType?: string;
	fetchImpl?: FetchLike;
	timeoutMs?: number;
}

/**
 * Quotes a value for JQL: a project id or an issue type id is digits and goes as it is; anything else is a string
 * literal with its quotes and backslashes escaped.
 */
export function jqlValue(value: string): string {
	if (/^\d+$/.test(value)) return value;
	return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * The JQL of an import: the project's issues (of the mapped issue types, when the mapping names some), changed in the
 * last minutes when a position is given, oldest change first so a run that stops can continue where it did. The
 * position is a relative period (`-<n>m`): an absolute date in JQL is read in the time zone of the token's account,
 * a relative one is not.
 */
export function importJqlOf(input: { projectId: string; issueTypeIds?: readonly string[] | null; updatedSince?: string | null; now?: number }): string {
	const clauses = [`project = ${jqlValue(input.projectId)}`];
	if (input.issueTypeIds?.length) clauses.push(`issuetype in (${input.issueTypeIds.map(jqlValue).join(', ')})`);
	if (input.updatedSince) {
		const since = Date.parse(input.updatedSince);
		if (Number.isFinite(since)) {
			const minutes = Math.max(1, Math.ceil(((input.now ?? Date.now()) - since) / 60_000) + 1);
			clauses.push(`updated >= "-${minutes}m"`);
		}
	}
	return `${clauses.join(' AND ')} ORDER BY updated ASC, key ASC`;
}

/**
 * The slice of Jira Cloud's REST API (v3, through the Atlassian API gateway of one site) the integration uses: the
 * account, the projects with their issue types and statuses, the priorities, the issues of a project page by page
 * (the enhanced JQL search), one issue, its transitions, an issue edit, transition, creation and deletion, and the
 * app's dynamic webhooks. A refused token (401), a rate limit (429, with its `Retry-After`) and any other refusal
 * each surface as a {@link JiraApiError}.
 */
export class JiraApiClient {
	private readonly baseUrl: string;
	private readonly authorization: string;
	/** The access token this client sends: compared, never answered (see {@link usesToken}). */
	private readonly accessToken: string;
	private readonly fetchImpl: FetchLike;
	private readonly timeoutMs: number;

	constructor(accessToken: string, readonly cloudId: string, options: JiraApiClientOptions = {}) {
		const gateway = (options.apiUrl ?? JIRA_API_GATEWAY_URL).replace(/\/+$/, '');
		this.baseUrl = `${gateway}/ex/jira/${encodeURIComponent(cloudId)}/rest/api/3`;
		this.authorization = `${options.tokenType || 'Bearer'} ${accessToken}`;
		this.accessToken = accessToken;
		this.fetchImpl = options.fetchImpl ?? ((globalThis as { fetch: FetchLike }).fetch as FetchLike);
		this.timeoutMs = options.timeoutMs ?? CALL_TIMEOUT_MS;
	}

	/** Whether this client sends that access token (a refusal names the token it was for). */
	usesToken(token: string | null | undefined): boolean {
		return !!token && token === this.accessToken;
	}

	/** One call: JSON in and out, a refusal as a {@link JiraApiError}; an empty answer (204) is `null`. */
	async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
			method,
			headers: {
				Accept: 'application/json',
				Authorization: this.authorization,
				...(body === undefined ? {} : { 'Content-Type': 'application/json' })
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
			signal: timeoutSignal(this.timeoutMs)
		});
		const text = await response.text();
		let parsed: unknown = null;
		if (text) {
			try {
				parsed = JSON.parse(text);
			} catch {
				parsed = null;
			}
		}
		if (response.status === 429) {
			throw new JiraApiError('Jira rate limit reached', 429, retryAfterSecondsOf(response.headers));
		}
		if (response.status >= 400) {
			throw new JiraApiError(errorMessageOf(parsed, `Jira answered HTTP ${response.status}`), response.status);
		}
		if (text && parsed === null) {
			throw new JiraApiError('Jira answered something that is not JSON', response.status);
		}
		return parsed as T;
	}

	async myself(): Promise<JiraMyself> {
		const me = await this.request<{ accountId: string; displayName?: string | null; emailAddress?: string | null }>('GET', '/myself');
		return { accountId: me.accountId, displayName: me.displayName ?? null, emailAddress: me.emailAddress ?? null };
	}

	/** Every project of the site the token may see. */
	async projects(): Promise<JiraProject[]> {
		const projects: JiraProject[] = [];
		let startAt = 0;
		for (let page = 0; page < 100; page++) {
			const data = await this.request<{ values: JiraProject[]; isLast?: boolean; total?: number }>(
				'GET',
				`/project/search?startAt=${startAt}&maxResults=50&orderBy=key`
			);
			const values = data?.values ?? [];
			projects.push(...values.map(({ id, key, name, projectTypeKey, style }) => ({ id: String(id), key, name, projectTypeKey: projectTypeKey ?? null, style: style ?? null })));
			startAt += values.length;
			if (data?.isLast !== false || !values.length) break;
		}
		return projects;
	}

	/**
	 * A project with its issue types and the statuses its workflows use (each once, in the order Jira lists them),
	 * or null when the token cannot see it.
	 */
	async project(projectIdOrKey: string): Promise<{ project: JiraProject; issueTypes: JiraIssueType[]; statuses: JiraStatus[] } | null> {
		let project: (JiraProject & { issueTypes?: JiraIssueType[] }) | null;
		try {
			project = await this.request<JiraProject & { issueTypes?: JiraIssueType[] }>('GET', `/project/${encodeURIComponent(projectIdOrKey)}`);
		} catch (error) {
			if (error instanceof JiraApiError && error.isNotFound) return null;
			throw error;
		}
		if (!project) return null;
		const byType = await this.request<Array<{ id: string; name: string; subtask?: boolean; statuses: JiraStatus[] }>>(
			'GET',
			`/project/${encodeURIComponent(projectIdOrKey)}/statuses`
		);
		const statuses = new Map<string, JiraStatus>();
		for (const type of byType ?? []) {
			for (const status of type.statuses ?? []) {
				if (status?.id && !statuses.has(String(status.id))) {
					statuses.set(String(status.id), { id: String(status.id), name: status.name, statusCategory: { key: status.statusCategory?.key ?? 'new', name: status.statusCategory?.name } });
				}
			}
		}
		return {
			project: { id: String(project.id), key: project.key, name: project.name, projectTypeKey: project.projectTypeKey ?? null, style: project.style ?? null },
			issueTypes: (project.issueTypes ?? []).map((type) => ({ id: String(type.id), name: type.name, subtask: !!type.subtask, hierarchyLevel: type.hierarchyLevel ?? null })),
			statuses: [...statuses.values()]
		};
	}

	/** The site's priorities. */
	async priorities(): Promise<JiraPriority[]> {
		const data = await this.request<Array<{ id: string; name: string }>>('GET', '/priority');
		return (data ?? []).map((priority) => ({ id: String(priority.id), name: priority.name }));
	}

	/** One page of an issue's comments, oldest first (`startAt` is an offset into them). */
	async issueComments(issueId: string, startAt: number, maxResults: number): Promise<{ comments: JiraComment[]; total: number }> {
		const query = new URLSearchParams({ startAt: String(startAt), maxResults: String(maxResults), orderBy: 'created' });
		const data = await this.request<{ comments?: JiraComment[]; total?: number }>('GET', `/issue/${encodeURIComponent(issueId)}/comment?${query.toString()}`);
		const comments = Array.isArray(data?.comments) ? data.comments : [];
		return { comments, total: typeof data?.total === 'number' ? data.total : startAt + comments.length };
	}

	/** One page of issues of a JQL search (the enhanced search: a page token, never an offset). */
	async searchIssues(jql: string, options: { nextPageToken?: string | null; maxResults?: number } = {}): Promise<{ issues: JiraIssue[]; nextPageToken: string | null }> {
		const data = await this.request<{ issues?: JiraIssue[]; nextPageToken?: string | null; isLast?: boolean }>('POST', '/search/jql', {
			jql,
			fields: JIRA_ISSUE_FIELDS,
			maxResults: options.maxResults ?? JIRA_ISSUES_PAGE_SIZE,
			...(options.nextPageToken ? { nextPageToken: options.nextPageToken } : {})
		});
		const issues = data?.issues ?? [];
		return { issues, nextPageToken: data?.isLast === true ? null : data?.nextPageToken || null };
	}

	/** One issue with every field the sync reads, or null when it is gone (or the token cannot see it). */
	async issue(idOrKey: string): Promise<JiraIssue | null> {
		try {
			return await this.request<JiraIssue>('GET', `/issue/${encodeURIComponent(idOrKey)}?fields=${JIRA_ISSUE_FIELDS.join(',')}`);
		} catch (error) {
			if (error instanceof JiraApiError && error.isNotFound) return null;
			throw error;
		}
	}

	/** The transitions the issue can take now, each with the status it leads to. */
	async transitions(idOrKey: string): Promise<JiraTransition[]> {
		const data = await this.request<{ transitions?: JiraTransition[] }>('GET', `/issue/${encodeURIComponent(idOrKey)}/transitions`);
		return (data?.transitions ?? []).map((transition) => ({
			id: String(transition.id),
			name: transition.name,
			to: { id: String(transition.to?.id ?? ''), name: transition.to?.name ?? '', statusCategory: { key: transition.to?.statusCategory?.key ?? 'new' } },
			isAvailable: transition.isAvailable,
			hasScreen: transition.hasScreen
		}));
	}

	async transitionIssue(idOrKey: string, transitionId: string): Promise<void> {
		await this.request<null>('POST', `/issue/${encodeURIComponent(idOrKey)}/transitions`, { transition: { id: transitionId } });
	}

	async updateIssue(idOrKey: string, fields: JiraIssueFieldsUpdate): Promise<void> {
		if (!Object.keys(fields).length) return;
		await this.request<null>('PUT', `/issue/${encodeURIComponent(idOrKey)}`, { fields });
	}

	async createIssue(fields: JiraIssueCreateInput): Promise<{ id: string; key: string }> {
		const created = await this.request<{ id: string; key: string }>('POST', '/issue', { fields });
		if (!created?.id) throw new JiraApiError('Jira did not create the issue');
		return { id: String(created.id), key: created.key };
	}

	/** Deletes an issue (the undo of a creation that could not be recorded). */
	async deleteIssue(idOrKey: string): Promise<void> {
		await this.request<null>('DELETE', `/issue/${encodeURIComponent(idOrKey)}`);
	}

	/** Registers the app's dynamic webhooks on the site for the connecting user: the ids Jira gave, or the errors it named. */
	async registerWebhooks(url: string, webhooks: Array<{ events: string[]; jqlFilter: string }>): Promise<JiraWebhookRegistration[]> {
		const data = await this.request<{ webhookRegistrationResult?: JiraWebhookRegistration[] }>('POST', '/webhook', { url, webhooks });
		return data?.webhookRegistrationResult ?? [];
	}

	/** Extends the life of the webhooks by 30 days: the new expiry, when Jira says. */
	async refreshWebhooks(webhookIds: readonly string[]): Promise<string | null> {
		const data = await this.request<{ expirationDate?: string | number | null }>('PUT', '/webhook/refresh', { webhookIds: webhookIds.map(Number) });
		const expiry = data?.expirationDate;
		if (expiry === undefined || expiry === null) return null;
		// Jira answers an ISO date or epoch milliseconds: `Date` reads both.
		const at = new Date(expiry);
		return Number.isNaN(at.getTime()) ? null : at.toISOString();
	}

	/** Removes webhooks (ids Jira does not know are ignored). */
	async deleteWebhooks(webhookIds: readonly string[]): Promise<void> {
		if (!webhookIds.length) return;
		await this.request<null>('DELETE', '/webhook', { webhookIds: webhookIds.map(Number) });
	}
}

/** The sites the token may reach that are Jira sites (they grant the Jira scope the sync needs). */
export async function accessibleJiraSites(accessToken: string, options: { apiUrl?: string; fetchImpl?: FetchLike } = {}): Promise<JiraSite[]> {
	const fetchImpl = options.fetchImpl ?? ((globalThis as { fetch: FetchLike }).fetch as FetchLike);
	const gateway = (options.apiUrl ?? JIRA_API_GATEWAY_URL).replace(/\/+$/, '');
	const response = await fetchImpl(`${gateway}/oauth/token/accessible-resources`, {
		method: 'GET',
		headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
		signal: timeoutSignal(CALL_TIMEOUT_MS)
	});
	const text = await response.text();
	if (response.status === 429) throw new JiraApiError('Jira rate limit reached', 429, retryAfterSecondsOf(response.headers));
	if (response.status >= 400) throw new JiraApiError(`Atlassian refused the site list (HTTP ${response.status})`, response.status);
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new JiraApiError('Atlassian answered something that is not JSON to the site list', response.status);
	}
	if (!Array.isArray(parsed)) return [];
	return parsed
		.filter((site): site is { id: string; url: string; name: string; scopes?: string[]; avatarUrl?: string } => !!site && typeof site === 'object' && typeof site.id === 'string')
		.map((site) => ({ id: site.id, url: String(site.url ?? ''), name: String(site.name ?? site.url ?? site.id), scopes: Array.isArray(site.scopes) ? site.scopes : [], avatarUrl: site.avatarUrl ?? null }))
		.filter((site) => !site.scopes.length || site.scopes.includes(JIRA_REQUIRED_SITE_SCOPE));
}

/** One JSON post to Atlassian's OAuth token endpoint, bounded in time; the token it answers. */
async function postTokenRequest(tokenUrl: string, body: Record<string, string>, fetchImpl: FetchLike, what: string): Promise<JiraOAuthToken> {
	const response = await fetchImpl(tokenUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify(body),
		signal: timeoutSignal(CALL_TIMEOUT_MS)
	});
	const text = await response.text();
	type TokenBody = { access_token?: string; token_type?: string; expires_in?: number; scope?: string; refresh_token?: string };
	let parsed: TokenBody | null;
	try {
		parsed = text ? (JSON.parse(text) as TokenBody) : null;
	} catch {
		parsed = null;
	}
	if (response.status >= 400) {
		// An `invalid_grant` refusal of a renewal is a 403: the refresh token is spent or revoked, a person must connect again.
		throw new JiraApiError(`Atlassian refused the ${what} (HTTP ${response.status}): ${errorMessageOf(parsed, 'no reason given')}`, response.status === 403 ? 401 : response.status);
	}
	if (!parsed) {
		throw new JiraApiError(`Atlassian answered something that is not JSON to the ${what}`, response.status);
	}
	if (!parsed.access_token) {
		throw new JiraApiError('Atlassian answered no access token', response.status);
	}
	return {
		accessToken: parsed.access_token,
		tokenType: parsed.token_type || 'Bearer',
		expiresIn: typeof parsed.expires_in === 'number' ? parsed.expires_in : null,
		scope: parsed.scope ?? null,
		refreshToken: typeof parsed.refresh_token === 'string' && parsed.refresh_token ? parsed.refresh_token : null
	};
}

/** Exchanges an authorization code for a token at Atlassian's OAuth endpoint. */
export function exchangeJiraCode(
	tokenUrl: string,
	input: { code: string; clientId: string; clientSecret: string; redirectUri: string },
	fetchImpl: FetchLike = (globalThis as { fetch: FetchLike }).fetch
): Promise<JiraOAuthToken> {
	return postTokenRequest(
		tokenUrl,
		{ grant_type: 'authorization_code', client_id: input.clientId, client_secret: input.clientSecret, code: input.code, redirect_uri: input.redirectUri },
		fetchImpl,
		'authorization code'
	);
}

/** Renews an access token with its refresh token; Atlassian answers a new pair (rotating: the old refresh token is spent). */
export function refreshJiraToken(
	tokenUrl: string,
	input: { refreshToken: string; clientId: string; clientSecret: string },
	fetchImpl: FetchLike = (globalThis as { fetch: FetchLike }).fetch
): Promise<JiraOAuthToken> {
	return postTokenRequest(
		tokenUrl,
		{ grant_type: 'refresh_token', client_id: input.clientId, client_secret: input.clientSecret, refresh_token: input.refreshToken },
		fetchImpl,
		'token refresh'
	);
}
