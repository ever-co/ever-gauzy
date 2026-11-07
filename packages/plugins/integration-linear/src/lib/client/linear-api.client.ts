import { LINEAR_API_URL, LINEAR_ISSUES_PAGE_SIZE } from '../linear.constants';

/** The kinds of workflow state Linear has; a mapping names a task status for each. */
export type LinearStateType = 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';

export interface LinearPageInfo {
	hasNextPage: boolean;
	endCursor: string | null;
}

export interface LinearOrganization {
	id: string;
	name: string;
	urlKey: string;
}

export interface LinearViewer {
	id: string;
	name: string;
	email: string | null;
	organization: LinearOrganization;
}

export interface LinearTeam {
	id: string;
	key: string;
	name: string;
}

export interface LinearWorkflowState {
	id: string;
	name: string;
	type: LinearStateType;
	position: number;
}

export interface LinearLabel {
	id: string;
	name: string;
	color: string | null;
}

export interface LinearUser {
	id: string;
	name: string;
	displayName: string | null;
	email: string | null;
}

/** A comment on an issue (Markdown), with who wrote it and the comment it answers, if any. */
export interface LinearComment {
	id: string;
	body: string | null;
	createdAt: string;
	updatedAt: string;
	user: LinearUser | null;
	parent: { id: string } | null;
}

/** A file or link on an issue: the address that opens it. */
export interface LinearAttachment {
	id: string;
	title: string | null;
	url: string | null;
}

export interface LinearIssue {
	id: string;
	identifier: string;
	title: string;
	description: string | null;
	/** 0 = none, 1 = urgent, 2 = high, 3 = medium, 4 = low. */
	priority: number;
	url: string;
	createdAt: string;
	updatedAt: string;
	archivedAt: string | null;
	completedAt: string | null;
	canceledAt: string | null;
	/** A calendar date (`YYYY-MM-DD`). */
	dueDate: string | null;
	estimate: number | null;
	state: LinearWorkflowState | null;
	assignee: LinearUser | null;
	labels: { nodes: LinearLabel[] };
	parent: { id: string } | null;
	team: { id: string; key: string } | null;
	project: { id: string; name: string } | null;
	/** The issue's latest fifty comments, oldest first, and its first twenty-five attachments: read with the issue. */
	comments?: { nodes: LinearComment[] } | null;
	attachments?: { nodes: LinearAttachment[] } | null;
}

export interface LinearIssueUpdateInput {
	title?: string;
	description?: string | null;
	stateId?: string;
	priority?: number;
	dueDate?: string | null;
}

export interface LinearIssueCreateInput extends LinearIssueUpdateInput {
	teamId: string;
	title: string;
}

/** What Linear answered when a call did not go through (its HTTP status, or a GraphQL error). */
export class LinearApiError extends Error {
	constructor(message: string, readonly status: number | null = null, readonly retryAfterSeconds: number | null = null) {
		super(message);
		this.name = 'LinearApiError';
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
}

/** The OAuth token Linear hands out (the code exchange and the refresh answer the same shape). */
export interface LinearOAuthToken {
	accessToken: string;
	tokenType: string;
	/** Seconds until the access token expires, when Linear says. */
	expiresIn: number | null;
	scope: string | null;
	/** The token that renews the access token, when Linear hands one out (rotated on every refresh). */
	refreshToken: string | null;
}

const ISSUE_FIELDS = `
	id identifier title description priority url createdAt updatedAt archivedAt completedAt canceledAt dueDate estimate
	state { id name type position }
	assignee { id name displayName email }
	labels { nodes { id name color } }
	parent { id }
	team { id key }
	project { id name }
	comments(first: 50, orderBy: createdAt) { nodes { id body createdAt updatedAt user { id name displayName email } parent { id } } }
	attachments(first: 25) { nodes { id title url } }
`;

type FetchLike = (
	input: string,
	init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }
) => Promise<{
	status: number;
	headers: { get(name: string): string | null };
	text(): Promise<string>;
}>;

/** How long one call to Linear may take. */
const CALL_TIMEOUT_MS = 30_000;

function timeoutSignal(ms: number): AbortSignal | undefined {
	return typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(ms) : undefined;
}

/**
 * The seconds to wait that a rate-limited answer names: `Retry-After` (seconds), else
 * `X-RateLimit-Requests-Reset` (a UTC epoch in milliseconds); null when neither is readable.
 */
export function retryAfterSecondsOf(headers: { get(name: string): string | null }, now = Date.now()): number | null {
	const retryAfter = headers.get('Retry-After')?.trim();
	if (retryAfter && /^\d+$/.test(retryAfter)) return Math.max(1, Number(retryAfter));
	const reset = headers.get('X-RateLimit-Requests-Reset')?.trim();
	if (reset && /^\d+$/.test(reset)) {
		const at = Number(reset);
		// Milliseconds since the epoch; a value in seconds is accepted too.
		const resetMs = at > 1e11 ? at : at * 1000;
		return Math.max(1, Math.ceil((resetMs - now) / 1000));
	}
	return null;
}

export interface LinearApiClientOptions {
	apiUrl?: string;
	/** `Bearer` for an OAuth token (the default); an API key is sent as it is. */
	tokenType?: string;
	fetchImpl?: FetchLike;
	timeoutMs?: number;
}

/**
 * The slice of Linear's GraphQL API the integration uses, over the platform's own `fetch`: the viewer and
 * workspace, the teams with their workflow states and labels, the issues of a team page by page (changed
 * since a watermark, archived ones included), one issue, and an issue update or creation. A refused
 * token, a rate limit (HTTP 429, or a `RATELIMITED` GraphQL error) and a GraphQL error each surface as a
 * {@link LinearApiError}.
 */
export class LinearApiClient {
	private readonly apiUrl: string;
	private readonly authorization: string;
	private readonly fetchImpl: FetchLike;
	private readonly timeoutMs: number;

	constructor(accessToken: string, options: LinearApiClientOptions = {}) {
		this.apiUrl = options.apiUrl ?? LINEAR_API_URL;
		const tokenType = options.tokenType ?? 'Bearer';
		this.authorization = tokenType ? `${tokenType} ${accessToken}` : accessToken;
		this.fetchImpl = options.fetchImpl ?? ((globalThis as { fetch: FetchLike }).fetch as FetchLike);
		this.timeoutMs = options.timeoutMs ?? CALL_TIMEOUT_MS;
	}

	async query<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
		const response = await this.fetchImpl(this.apiUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: this.authorization },
			body: JSON.stringify({ query, variables }),
			signal: timeoutSignal(this.timeoutMs)
		});
		const text = await response.text();
		if (response.status === 429) {
			throw new LinearApiError('Linear rate limit reached', 429, retryAfterSecondsOf(response.headers));
		}
		let body: { data?: T; errors?: Array<{ message: string; extensions?: { code?: string; type?: string } }> } | null = null;
		try {
			body = JSON.parse(text);
		} catch {
			body = null;
		}
		const errors = body?.errors ?? [];
		if (errors.some((error) => /RATELIMITED/i.test(error.extensions?.code ?? error.extensions?.type ?? ''))) {
			throw new LinearApiError(errors[0]?.message || 'Linear rate limit reached', 429, retryAfterSecondsOf(response.headers));
		}
		if (response.status >= 400) {
			throw new LinearApiError(errors[0]?.message || `Linear answered HTTP ${response.status}`, response.status);
		}
		if (!body) {
			throw new LinearApiError('Linear answered something that is not JSON', response.status);
		}
		if (errors.length) {
			const first = errors[0];
			const code = first.extensions?.code ?? first.extensions?.type ?? '';
			const unauthorized = /AUTHENTICATION|UNAUTHENTICATED|FORBIDDEN/i.test(code) || /authentication|unauthorized/i.test(first.message);
			throw new LinearApiError(first.message, unauthorized ? 401 : null);
		}
		if (!body.data) {
			throw new LinearApiError('Linear answered no data', response.status);
		}
		return body.data;
	}

	async viewer(): Promise<LinearViewer> {
		const data = await this.query<{ viewer: LinearViewer }>('query { viewer { id name email organization { id name urlKey } } }');
		return data.viewer;
	}

	/** Every team of the workspace the token may see. */
	async teams(): Promise<LinearTeam[]> {
		type TeamsPage = { teams: { nodes: LinearTeam[]; pageInfo: LinearPageInfo } };
		const teams: LinearTeam[] = [];
		let after: string | null = null;
		for (;;) {
			// Annotated: `after` feeds the query and is read back from its answer, which leaves `data` untyped
			// under `noImplicitAny` (TS7022) otherwise.
			const data: TeamsPage = await this.query<TeamsPage>(
				'query($after: String) { teams(first: 100, after: $after) { nodes { id key name } pageInfo { hasNextPage endCursor } } }',
				{ after }
			);
			teams.push(...data.teams.nodes);
			if (!data.teams.pageInfo.hasNextPage || !data.teams.pageInfo.endCursor) break;
			after = data.teams.pageInfo.endCursor;
		}
		return teams;
	}

	/** A team with its workflow states (in board order) and its labels. */
	async team(teamId: string): Promise<{ team: LinearTeam; states: LinearWorkflowState[]; labels: LinearLabel[] } | null> {
		const data = await this.query<{
			team: (LinearTeam & { states: { nodes: LinearWorkflowState[] }; labels: { nodes: LinearLabel[] } }) | null;
		}>(
			'query($id: String!) { team(id: $id) { id key name states(first: 100) { nodes { id name type position } } labels(first: 250) { nodes { id name color } } } }',
			{ id: teamId }
		);
		if (!data.team) return null;
		const { states, labels, ...team } = data.team;
		return { team, states: [...states.nodes].sort((a, b) => a.position - b.position), labels: labels.nodes };
	}

	/**
	 * One page of a team's issues, newest change first (Linear's `orderBy: updatedAt`), those changed after the
	 * watermark when one is given, archived ones included.
	 */
	async issues(
		teamId: string,
		options: { updatedAfter?: string | null; after?: string | null; first?: number } = {}
	): Promise<{ nodes: LinearIssue[]; pageInfo: LinearPageInfo }> {
		const filter: Record<string, unknown> = { team: { id: { eq: teamId } } };
		if (options.updatedAfter) filter['updatedAt'] = { gt: options.updatedAfter };
		const data = await this.query<{ issues: { nodes: LinearIssue[]; pageInfo: LinearPageInfo } }>(
			`query($filter: IssueFilter, $after: String, $first: Int!) {
				issues(filter: $filter, after: $after, first: $first, orderBy: updatedAt, includeArchived: true) {
					nodes { ${ISSUE_FIELDS} }
					pageInfo { hasNextPage endCursor }
				}
			}`,
			{ filter, after: options.after ?? null, first: options.first ?? LINEAR_ISSUES_PAGE_SIZE }
		);
		return data.issues;
	}

	/** The team an issue belongs to: a light read for a delivery that names the issue alone. */
	async issueTeamId(id: string): Promise<string | null> {
		const data = await this.query<{ issue: { team: { id: string } | null } | null }>('query($id: String!) { issue(id: $id) { team { id } } }', { id });
		return data.issue?.team?.id ?? null;
	}

	async issue(id: string): Promise<LinearIssue | null> {
		const data = await this.query<{ issue: LinearIssue | null }>(`query($id: String!) { issue(id: $id) { ${ISSUE_FIELDS} } }`, { id });
		return data.issue;
	}

	async updateIssue(id: string, input: LinearIssueUpdateInput): Promise<LinearIssue> {
		const data = await this.query<{ issueUpdate: { success: boolean; issue: LinearIssue } }>(
			`mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { ${ISSUE_FIELDS} } } }`,
			{ id, input }
		);
		if (!data.issueUpdate.success) throw new LinearApiError('Linear did not apply the issue update');
		return data.issueUpdate.issue;
	}

	/** Archives an issue (the undo of a creation that could not be recorded). */
	async archiveIssue(id: string): Promise<boolean> {
		const data = await this.query<{ issueArchive: { success: boolean } }>('mutation($id: String!) { issueArchive(id: $id) { success } }', { id });
		return !!data.issueArchive?.success;
	}

	async createIssue(input: LinearIssueCreateInput): Promise<LinearIssue> {
		const data = await this.query<{ issueCreate: { success: boolean; issue: LinearIssue } }>(
			`mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { ${ISSUE_FIELDS} } } }`,
			{ input }
		);
		if (!data.issueCreate.success) throw new LinearApiError('Linear did not create the issue');
		return data.issueCreate.issue;
	}
}

/** One form post to Linear's OAuth token endpoint, bounded in time; the token it answers. */
async function postTokenRequest(tokenUrl: string, form: Record<string, string>, fetchImpl: FetchLike, what: string): Promise<LinearOAuthToken> {
	const response = await fetchImpl(tokenUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
		body: new URLSearchParams(form).toString(),
		signal: timeoutSignal(CALL_TIMEOUT_MS)
	});
	const text = await response.text();
	if (response.status >= 400) {
		throw new LinearApiError(`Linear refused the ${what} (HTTP ${response.status})`, response.status);
	}
	let parsed: { access_token?: string; token_type?: string; expires_in?: number; scope?: string; refresh_token?: string };
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new LinearApiError(`Linear answered something that is not JSON to the ${what}`, response.status);
	}
	if (!parsed.access_token) {
		throw new LinearApiError('Linear answered no access token', response.status);
	}
	return {
		accessToken: parsed.access_token,
		tokenType: parsed.token_type || 'Bearer',
		expiresIn: typeof parsed.expires_in === 'number' ? parsed.expires_in : null,
		scope: parsed.scope ?? null,
		refreshToken: typeof parsed.refresh_token === 'string' && parsed.refresh_token ? parsed.refresh_token : null
	};
}

/** Exchanges an authorization code for a token at Linear's OAuth endpoint. */
export function exchangeLinearCode(
	tokenUrl: string,
	input: { code: string; clientId: string; clientSecret: string; redirectUri: string },
	fetchImpl: FetchLike = (globalThis as { fetch: FetchLike }).fetch
): Promise<LinearOAuthToken> {
	return postTokenRequest(
		tokenUrl,
		{ code: input.code, redirect_uri: input.redirectUri, client_id: input.clientId, client_secret: input.clientSecret, grant_type: 'authorization_code' },
		fetchImpl,
		'authorization code'
	);
}

/** Renews an access token with its refresh token; Linear answers a new pair (the old refresh token is spent). */
export function refreshLinearToken(
	tokenUrl: string,
	input: { refreshToken: string; clientId: string; clientSecret: string },
	fetchImpl: FetchLike = (globalThis as { fetch: FetchLike }).fetch
): Promise<LinearOAuthToken> {
	return postTokenRequest(
		tokenUrl,
		{ refresh_token: input.refreshToken, client_id: input.clientId, client_secret: input.clientSecret, grant_type: 'refresh_token' },
		fetchImpl,
		'token refresh'
	);
}
