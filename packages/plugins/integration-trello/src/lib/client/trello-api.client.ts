import { TRELLO_API_URL } from '../trello.constants';

export interface TrelloMember {
	id: string;
	username: string;
	fullName: string;
	/** Only the token's own member has an e-mail. */
	email: string | null;
}

export interface TrelloBoard {
	id: string;
	name: string;
	closed: boolean;
	idOrganization: string | null;
	url: string | null;
}

export interface TrelloList {
	id: string;
	name: string;
	closed: boolean;
	pos: number;
}

export interface TrelloLabel {
	id: string;
	name: string;
	color: string | null;
}

export interface TrelloCard {
	id: string;
	name: string;
	desc: string | null;
	/** Archived. */
	closed: boolean;
	idBoard: string;
	idList: string;
	/** An ISO date-time, or null. */
	due: string | null;
	dueComplete: boolean;
	dateLastActivity: string;
	shortUrl: string | null;
	pos: number;
	idMembers: string[];
	idLabels: string[];
	labels: TrelloLabel[];
	members: Array<Pick<TrelloMember, 'id' | 'username' | 'fullName'>>;
}

/** A comment on a card: Trello keeps it as a `commentCard` action, with the member who wrote it. */
export interface TrelloCommentAction {
	id: string;
	type: string;
	date: string;
	data: { text?: string | null } | null;
	memberCreator: Pick<TrelloMember, 'id' | 'username' | 'fullName'> | null;
}

/** A file or link on a card: the address that opens it. */
export interface TrelloAttachment {
	id: string;
	name: string | null;
	url: string | null;
	date: string;
	isUpload: boolean;
}

export interface TrelloCardUpdateInput {
	name?: string;
	desc?: string;
	idList?: string;
	due?: string | null;
	dueComplete?: boolean;
	closed?: boolean;
}

export interface TrelloWebhook {
	id: string;
	active: boolean;
	idModel: string;
	callbackURL: string;
	description: string | null;
}

/** What Trello answered when a call did not go through (its HTTP status, or an error in the body). */
export class TrelloApiError extends Error {
	constructor(message: string, readonly status: number | null = null, readonly retryAfterSeconds: number | null = null) {
		super(message);
		this.name = 'TrelloApiError';
	}

	/** The token or the key was refused: the connection needs a fresh token, or a person. */
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

const CARD_FIELDS = 'id,name,desc,closed,idBoard,idList,due,dueComplete,dateLastActivity,shortUrl,pos,idMembers,idLabels';
const MEMBER_FIELDS = 'id,username,fullName';

type FetchLike = (
	input: string,
	init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }
) => Promise<{
	status: number;
	headers: { get(name: string): string | null };
	text(): Promise<string>;
}>;

/** How long one call to Trello may take. */
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

export interface TrelloApiClientOptions {
	apiUrl?: string;
	fetchImpl?: FetchLike;
	timeoutMs?: number;
}

/**
 * The slice of Trello's REST API the integration uses, over the platform's own `fetch`, every call carrying the
 * application's key and the member's token: the member, their boards, a board's lists and labels, the cards of a
 * board page by page (with their members and labels), one card, a card update, a card creation, and the webhooks
 * of the token. A refused token, a rate limit and an API error each surface as a {@link TrelloApiError}.
 */
export class TrelloApiClient {
	private readonly apiUrl: string;
	private readonly fetchImpl: FetchLike;
	private readonly timeoutMs: number;

	constructor(private readonly apiKey: string, private readonly token: string, options: TrelloApiClientOptions = {}) {
		this.apiUrl = options.apiUrl ?? TRELLO_API_URL;
		this.fetchImpl = options.fetchImpl ?? ((globalThis as { fetch: FetchLike }).fetch as FetchLike);
		this.timeoutMs = options.timeoutMs ?? CALL_TIMEOUT_MS;
	}

	/** One call; the JSON it answers. The key and the token travel as query parameters, as Trello wants them. */
	async call<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, params: Record<string, string> = {}, body?: unknown): Promise<T> {
		const query = new URLSearchParams({ ...params, key: this.apiKey, token: this.token });
		const response = await this.fetchImpl(`${this.apiUrl}${path}?${query.toString()}`, {
			method,
			headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
			body: body === undefined ? undefined : JSON.stringify(body),
			signal: timeoutSignal(this.timeoutMs)
		});
		const text = await response.text();
		if (response.status === 429) {
			throw new TrelloApiError('Trello rate limit reached', 429, retryAfterSecondsOf(response.headers));
		}
		if (response.status >= 400) {
			throw new TrelloApiError(errorMessageOf(text) || `Trello answered HTTP ${response.status}`, response.status);
		}
		if (!text.trim()) return undefined as T;
		try {
			return JSON.parse(text) as T;
		} catch {
			throw new TrelloApiError('Trello answered something that is not JSON', response.status);
		}
	}

	async me(): Promise<TrelloMember> {
		const member = await this.call<Partial<TrelloMember>>('GET', '/members/me', { fields: 'id,username,fullName,email' });
		return { id: String(member.id), username: member.username ?? '', fullName: member.fullName ?? '', email: member.email ?? null };
	}

	/** The open boards the member may see. */
	async boards(): Promise<TrelloBoard[]> {
		const boards = await this.call<TrelloBoard[]>('GET', '/members/me/boards', { filter: 'open', fields: 'id,name,closed,idOrganization,url' });
		return (boards ?? []).map((board) => ({ ...board, idOrganization: board.idOrganization ?? null, url: board.url ?? null }));
	}

	/** The open lists of a board, in their order. */
	async lists(boardId: string): Promise<TrelloList[]> {
		const lists = await this.call<TrelloList[]>('GET', `/boards/${encodeURIComponent(boardId)}/lists`, { filter: 'open', fields: 'id,name,closed,pos' });
		return [...(lists ?? [])].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
	}

	async labels(boardId: string): Promise<TrelloLabel[]> {
		const labels = await this.call<TrelloLabel[]>('GET', `/boards/${encodeURIComponent(boardId)}/labels`, { fields: 'id,name,color', limit: '1000' });
		return (labels ?? []).map((label) => ({ ...label, color: label.color ?? null }));
	}

	/**
	 * One page of a board's cards (open and archived), with their members and labels; the id to page on from
	 * comes back with it (Trello pages backwards by card id).
	 */
	async cards(boardId: string, options: { before?: string | null; limit?: number } = {}): Promise<{ items: TrelloCard[]; nextBefore: string | null }> {
		const params: Record<string, string> = {
			filter: 'all',
			fields: CARD_FIELDS,
			members: 'true',
			member_fields: MEMBER_FIELDS,
			labels: 'true',
			limit: String(options.limit ?? 1000),
			sort: '-id'
		};
		if (options.before) params['before'] = options.before;
		const cards = await this.call<TrelloCard[]>('GET', `/boards/${encodeURIComponent(boardId)}/cards`, params);
		const items = (cards ?? []).map(normaliseCard);
		const limit = Number(params['limit']);
		// A page shorter than the limit is the last; otherwise the oldest card of this page is where the next starts.
		const nextBefore = items.length >= limit ? (items[items.length - 1]?.id ?? null) : null;
		return { items, nextBefore };
	}

	async card(id: string): Promise<TrelloCard | null> {
		try {
			const card = await this.call<TrelloCard>('GET', `/cards/${encodeURIComponent(id)}`, { fields: CARD_FIELDS, members: 'true', member_fields: MEMBER_FIELDS, labels: 'true' });
			return normaliseCard(card);
		} catch (error) {
			if (error instanceof TrelloApiError && error.isNotFound) return null;
			throw error;
		}
	}

	/** The comments of a card (its `commentCard` actions), oldest first; Trello answers the newest thousand. */
	async comments(cardId: string): Promise<TrelloCommentAction[]> {
		const actions = await this.call<TrelloCommentAction[]>('GET', `/cards/${encodeURIComponent(cardId)}/actions`, {
			filter: 'commentCard',
			limit: '1000',
			fields: 'id,type,date,data',
			memberCreator: 'true',
			memberCreator_fields: MEMBER_FIELDS
		});
		return (actions ?? []).filter((action) => action?.type === 'commentCard').reverse();
	}

	/** The files and links of a card. */
	async attachments(cardId: string): Promise<TrelloAttachment[]> {
		return (await this.call<TrelloAttachment[]>('GET', `/cards/${encodeURIComponent(cardId)}/attachments`, { fields: 'id,name,url,date,isUpload' })) ?? [];
	}

	async updateCard(id: string, input: TrelloCardUpdateInput): Promise<TrelloCard> {
		const params: Record<string, string> = {};
		if (input.name !== undefined) params['name'] = input.name;
		if (input.desc !== undefined) params['desc'] = input.desc;
		if (input.idList !== undefined) params['idList'] = input.idList;
		if (input.due !== undefined) params['due'] = input.due ?? '';
		if (input.dueComplete !== undefined) params['dueComplete'] = String(input.dueComplete);
		if (input.closed !== undefined) params['closed'] = String(input.closed);
		const card = await this.call<TrelloCard>('PUT', `/cards/${encodeURIComponent(id)}`, { ...params, fields: CARD_FIELDS, members: 'true', member_fields: MEMBER_FIELDS, labels: 'true' });
		return normaliseCard(card);
	}

	async createCard(input: { idList: string; name: string; desc?: string; due?: string | null; dueComplete?: boolean }): Promise<TrelloCard> {
		const params: Record<string, string> = { idList: input.idList, name: input.name, fields: CARD_FIELDS, members: 'true', member_fields: MEMBER_FIELDS, labels: 'true' };
		if (input.desc !== undefined) params['desc'] = input.desc;
		if (input.due) params['due'] = input.due;
		if (input.dueComplete !== undefined) params['dueComplete'] = String(input.dueComplete);
		return normaliseCard(await this.call<TrelloCard>('POST', '/cards', params));
	}

	/** The webhooks of the token (Trello lists them per token). */
	async webhooks(): Promise<TrelloWebhook[]> {
		const webhooks = await this.call<TrelloWebhook[]>('GET', `/tokens/${encodeURIComponent(this.token)}/webhooks`);
		return (webhooks ?? []).map((webhook) => ({ ...webhook, description: webhook.description ?? null }));
	}

	/**
	 * Registers a webhook on a board: Trello sends a HEAD request to the callback before answering, so the
	 * receiver must be reachable now.
	 */
	async createWebhook(input: { idModel: string; callbackURL: string; description: string }): Promise<TrelloWebhook> {
		const webhook = await this.call<TrelloWebhook>('POST', '/webhooks', { idModel: input.idModel, callbackURL: input.callbackURL, description: input.description });
		return { ...webhook, description: webhook.description ?? null };
	}

	async deleteWebhook(id: string): Promise<void> {
		try {
			await this.call<unknown>('DELETE', `/webhooks/${encodeURIComponent(id)}`);
		} catch (error) {
			if (error instanceof TrelloApiError && error.isNotFound) return;
			throw error;
		}
	}
}

/** Trello's error bodies are plain text (`invalid token`) or `{ message }`. */
function errorMessageOf(text: string): string {
	const trimmed = text.trim();
	if (!trimmed) return '';
	try {
		const parsed = JSON.parse(trimmed) as { message?: unknown; error?: unknown };
		if (typeof parsed?.message === 'string') return parsed.message;
		if (typeof parsed?.error === 'string') return parsed.error;
	} catch {
		// plain text
	}
	return trimmed.slice(0, 200);
}

function normaliseCard(card: TrelloCard): TrelloCard {
	return {
		...card,
		desc: card.desc ?? null,
		closed: !!card.closed,
		due: card.due ?? null,
		dueComplete: !!card.dueComplete,
		shortUrl: card.shortUrl ?? null,
		pos: typeof card.pos === 'number' ? card.pos : 0,
		idMembers: card.idMembers ?? [],
		idLabels: card.idLabels ?? [],
		labels: (card.labels ?? []).map((label) => ({ id: label.id, name: label.name ?? '', color: label.color ?? null })),
		members: (card.members ?? []).map((member) => ({ id: member.id, username: member.username ?? '', fullName: member.fullName ?? '' }))
	};
}
