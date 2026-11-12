import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChatLinkPreviewStatusEnum, ID, IChatLinkPreview } from '@gauzy/contracts';
import { SchedulerQueueService } from '@gauzy/scheduler';
import { ChatLinkPreview } from '../entities/chat-link-preview.entity';
import type { IChatCaller } from '../services/chat-access.service';
import {
	CHAT_LINK_PREVIEW_FETCH_JOB,
	CHAT_LINK_PREVIEW_FETCHES_PER_MINUTE,
	CHAT_LINK_PREVIEW_INLINE_CONCURRENCY,
	CHAT_LINK_PREVIEW_PENDING_TTL_MS,
	CHAT_LINK_PREVIEW_QUEUE,
	CHAT_LINK_PREVIEW_READY_TTL_MS,
	CHAT_LINK_PREVIEW_UNAVAILABLE_TTL_MS
} from './chat-link-preview.constants';
import { fetchPreviewPage, isTransientFailure, LinkPreviewFetchFailed, LinkPreviewFetchOutcome } from './link-preview-fetcher';
import { decodePage, ILinkPreviewData, parsePreviewHead } from './link-preview-parser';
import { LinkPreviewUrlError, normalizePreviewUrl, previewTargetRefusal, previewUrlHash } from './link-preview-url';

/** How the plugin was configured at boot: previews on (`GAUZY_CHAT_LINK_PREVIEWS_ENABLED`), and on a queue or inline. */
export interface IChatLinkPreviewOptions {
	enabled: boolean;
	/** A queue root exists and the preview queue is registered: fetches travel on it. */
	queued: boolean;
	/** The platform also serves the previews' pictures (`GAUZY_CHAT_LINK_PREVIEW_IMAGES_ENABLED`). */
	images?: boolean;
}
export const CHAT_LINK_PREVIEW_OPTIONS = 'CHAT_LINK_PREVIEW_OPTIONS';

/** The fetch a refresh makes. A seam: the server uses `fetchPreviewPage`, specs answer without a network. */
export type ChatLinkPreviewFetcher = (url: string) => Promise<LinkPreviewFetchOutcome>;
export const CHAT_LINK_PREVIEW_FETCHER = 'CHAT_LINK_PREVIEW_FETCHER';

/** What a fetch job carries: no person, only the tenant whose cache it fills and the link. */
export interface IChatLinkPreviewFetchJob {
	tenantId: ID;
	url: string;
}

/** What a cached row means now. */
export type ChatLinkPreviewAction = 'serve' | 'refresh' | 'fetch' | 'wait';

/**
 * The refresh policy (`CHAT_LINK_PREVIEW_*_TTL_MS`).
 *
 * - no row: fetch;
 * - `ready`: served; once older than its time it is still served, and fetched again behind it;
 * - `unavailable`: served (no preview) until its shorter time is up, then fetched again;
 * - `pending`: waited for, unless it has been pending longer than a fetch can take (the process that took it stopped),
 *   then fetched again.
 */
export function previewAction(row: Pick<ChatLinkPreview, 'status' | 'fetchedAt' | 'updatedAt'> | null, now: number): ChatLinkPreviewAction {
	if (!row) return 'fetch';
	const at = (value?: Date | string | null) => (value ? new Date(value).getTime() : Number.NaN);
	if (row.status === ChatLinkPreviewStatusEnum.READY) {
		const age = now - at(row.fetchedAt);
		return age >= 0 && age < CHAT_LINK_PREVIEW_READY_TTL_MS ? 'serve' : 'refresh';
	}
	if (row.status === ChatLinkPreviewStatusEnum.UNAVAILABLE) {
		const age = now - at(row.fetchedAt);
		return age >= 0 && age < CHAT_LINK_PREVIEW_UNAVAILABLE_TTL_MS ? 'serve' : 'fetch';
	}
	const waited = now - at(row.updatedAt);
	return waited >= 0 && waited < CHAT_LINK_PREVIEW_PENDING_TTL_MS ? 'wait' : 'fetch';
}

/**
 * Link previews (the chat spec FR-20): what `GET /chat/link-preview?url=` answers, from the per-tenant cache, and the
 * fetch that fills it.
 *
 * A link the cache has no fresh answer for is fetched in the background. With a queue root (`queued`) the fetch is a job
 * on the `chat-link-preview` queue, one per tenant and link at a time (the job id), taken by `ChatLinkPreviewWorker`;
 * the route answers `pending` and the client asks again. Without one there is no queue to put it on and the fetch runs
 * in the process that was asked, at most a few at once, and the route waits for it (a fetch is bounded to a few
 * seconds). A queue that refuses the job falls back to the same inline fetch.
 *
 * A link whose host is internal by name or a non-public address literal answers `unavailable` at once: nothing is
 * fetched or stored. Every other refusal (a host that resolves privately, a redirect inward, a page too slow, not
 * HTML, or with nothing to show) is stored as `unavailable` and answers the same, so the route tells the asker nothing
 * about the network behind the server.
 */
@Injectable()
export class ChatLinkPreviewService {
	private readonly logger = new Logger(ChatLinkPreviewService.name);
	private readonly fetcher: ChatLinkPreviewFetcher;
	/** The inline fetches running in this process, by tenant and link: a second ask joins the first. */
	private readonly inFlight = new Map<string, Promise<IChatLinkPreview>>();
	/** When each person (tenant and user) last started fetches, for the per-person budget. */
	private readonly fetchesStarted = new Map<string, number[]>();
	/** When a fetch of each tenant and link was last queued (refreshes are not queued again within the pending time). */
	private readonly queuedAt = new Map<string, number>();
	private queueFailureReported = false;

	constructor(
		private readonly dataSource: DataSource,
		@Inject(CHAT_LINK_PREVIEW_OPTIONS) private readonly options: IChatLinkPreviewOptions,
		@Optional() @Inject(CHAT_LINK_PREVIEW_FETCHER) fetcher?: ChatLinkPreviewFetcher,
		@Optional() private readonly queue?: SchedulerQueueService
	) {
		this.fetcher = fetcher ?? ((url) => fetchPreviewPage(url));
	}

	/**
	 * The preview of a link, for a caller of the chat routes.
	 *
	 * @throws NotFoundException while previews are off; BadRequestException for a value that is not an http(s) link;
	 * 429 when the caller started more fetches this minute than the budget allows (`CHAT_LINK_PREVIEW_FETCHES_PER_MINUTE`).
	 */
	async preview(caller: IChatCaller, raw: string): Promise<IChatLinkPreview> {
		if (!this.options.enabled) throw new NotFoundException('The requested record was not found');
		let url: URL;
		try {
			url = normalizePreviewUrl(raw);
		} catch (error) {
			if (error instanceof LinkPreviewUrlError) throw new BadRequestException(error.message);
			throw error;
		}
		const href = url.href;
		if (previewTargetRefusal(url)) return answer(href, ChatLinkPreviewStatusEnum.UNAVAILABLE);
		const tenantId = caller.tenantId;
		const row = await this.repository().findOne({ where: { tenantId, urlHash: previewUrlHash(href) } });
		const action = previewAction(row, Date.now());
		if (row && action === 'serve') return fromRow(href, row);
		if (action === 'wait') return answer(href, ChatLinkPreviewStatusEnum.PENDING);
		if (row && action === 'refresh') {
			// The stale preview now, the new one on the next ask (unless the caller's budget is spent: then only the stale one).
			void this.dispatch(caller, href, false).catch(() => undefined);
			return fromRow(href, row);
		}
		return this.dispatch(caller, href, true);
	}

	/**
	 * Takes one fetch from the caller's budget for the minute, or answers false when it is spent. Only a fetch is counted
	 * (a link the cache answers costs nothing), and the budget holds whether or not the platform's rate limiter is on
	 * (`THROTTLE_ENABLED`): each fetch is an outbound request, so one person must not start them without bound. Kept per
	 * process, like the inline fetches. Spent when a fetch is admitted (queued, or started inline), never by an ask that
	 * joins a fetch already running, waits for one, or is answered `pending` because too many run. The preview pictures
	 * spend from the same budget.
	 */
	spendFetch(caller: IChatCaller): boolean {
		const key = `${caller.tenantId}:${caller.userId}`;
		const now = Date.now();
		const recent = (this.fetchesStarted.get(key) ?? []).filter((at) => now - at < 60_000);
		if (recent.length >= CHAT_LINK_PREVIEW_FETCHES_PER_MINUTE) {
			this.fetchesStarted.set(key, recent);
			return false;
		}
		recent.push(now);
		this.fetchesStarted.set(key, recent);
		if (this.fetchesStarted.size > 10_000) {
			// Forget the people with nothing left in their minute, so the map follows who is active.
			for (const [person, times] of this.fetchesStarted) {
				if (!times.some((at) => now - at < 60_000)) this.fetchesStarted.delete(person);
			}
		}
		return true;
	}

	/**
	 * Fetches a link and stores what it gave (a preview, or "unavailable"). What the queue worker and the inline path
	 * run; never throws for a page that could not be fetched.
	 */
	async refresh(tenantId: ID, link: string): Promise<IChatLinkPreview> {
		const href = normalizePreviewUrl(link).href;
		let outcome: LinkPreviewFetchOutcome;
		try {
			outcome = await this.fetcher(href);
		} catch {
			outcome = { ok: false, reason: 'error' };
		}
		let data: ILinkPreviewData | null = null;
		if (outcome.ok) {
			data = parsePreviewHead(decodePage(outcome.body, outcome.charset), outcome.url);
		} else {
			// The reason only: a link can carry a secret (a share token), so it is never logged.
			this.logger.debug(`A link preview was not fetched (${(outcome as LinkPreviewFetchFailed).reason}).`);
			if (isTransientFailure(outcome)) {
				// The site is slow, down or busy for now: a good preview it has is kept, and tried again after the
				// "unavailable" time rather than a whole day (its fetch time is set back to make it so).
				const previous = await this.repository().findOne({ where: { tenantId, urlHash: previewUrlHash(href) } });
				if (previous?.status === ChatLinkPreviewStatusEnum.READY && previous.data) {
					const retryAt = new Date(Date.now() - CHAT_LINK_PREVIEW_READY_TTL_MS + CHAT_LINK_PREVIEW_UNAVAILABLE_TTL_MS);
					await this.store(tenantId, href, { status: ChatLinkPreviewStatusEnum.READY, data: previous.data, fetchedAt: retryAt });
					return fromRow(href, Object.assign(previous, { fetchedAt: retryAt }));
				}
			}
		}
		const status = data ? ChatLinkPreviewStatusEnum.READY : ChatLinkPreviewStatusEnum.UNAVAILABLE;
		const fetchedAt = new Date();
		await this.store(tenantId, href, { status, data: data ? JSON.stringify(data) : null, fetchedAt });
		return { ...(data ?? {}), url: href, status, fetchedAt };
	}

	/**
	 * Puts a fetch on the queue, or runs it here; answers what the asker gets now. `waitInline`: the asker has no preview
	 * to be served meanwhile (a first fetch), so an inline fetch is waited for and a spent budget answers 429; otherwise
	 * (a stale preview being served) the fetch runs behind it, or not at all when the budget is spent.
	 *
	 * @throws HttpException 429 when a first fetch would be admitted and the caller's budget is spent.
	 */
	private async dispatch(caller: IChatCaller, href: string, waitInline: boolean): Promise<IChatLinkPreview> {
		const tenantId = caller.tenantId;
		const key = `${tenantId}:${previewUrlHash(href)}`;
		if (this.options.queued && this.queue) {
			// A fetch queued a moment ago (or being queued right now) is not queued again (BullMQ would ignore the job id
			// anyway): the asks of a stale preview, and a burst of first asks, spend neither the budget nor a call to the
			// queue for every reader. The key is reserved before anything is awaited, so a concurrent ask sees it.
			if (this.recentlyQueued(key)) return answer(href, ChatLinkPreviewStatusEnum.PENDING);
			if (!this.admit(caller, waitInline)) return answer(href, ChatLinkPreviewStatusEnum.PENDING);
			this.queuedAt.set(key, Date.now());
			try {
				if (waitInline) await this.store(tenantId, href, { status: ChatLinkPreviewStatusEnum.PENDING });
				await this.queue.enqueue<IChatLinkPreviewFetchJob>({
					queueName: CHAT_LINK_PREVIEW_QUEUE,
					jobName: CHAT_LINK_PREVIEW_FETCH_JOB,
					data: { tenantId, url: href },
					options: {
						// One job per tenant and link at a time (BullMQ ignores an id it holds); gone once it ran, so the
						// next refresh can be queued.
						jobId: `chat-link-preview-${tenantId}-${previewUrlHash(href)}`,
						attempts: 1,
						removeOnComplete: true,
						removeOnFail: true
					}
				});
				return answer(href, ChatLinkPreviewStatusEnum.PENDING);
			} catch (error) {
				// Not queued after all: the reservation goes, and the inline fetch below (already admitted) takes over.
				this.queuedAt.delete(key);
				if (!this.queueFailureReported) {
					this.queueFailureReported = true;
					this.logger.warn(`The link preview queue refused a fetch; fetching in this process instead: ${(error as Error)?.message}`);
				}
				// Admitted (and spent) already: the inline fetch below is the same fetch.
				return this.inline(caller, href, waitInline, true);
			}
		}
		return this.inline(caller, href, waitInline, false);
	}

	/**
	 * An inline fetch: joined when one for the same tenant and link runs, `pending` when too many run already, and only
	 * then admitted against the caller's budget.
	 */
	private inline(caller: IChatCaller, href: string, waitInline: boolean, admitted: boolean): Promise<IChatLinkPreview> {
		const pending = () => Promise.resolve(answer(href, ChatLinkPreviewStatusEnum.PENDING));
		const key = `${caller.tenantId}:${previewUrlHash(href)}`;
		const running = this.inFlight.get(key);
		if (running) return waitInline ? running : pending();
		if (this.inFlight.size >= CHAT_LINK_PREVIEW_INLINE_CONCURRENCY) return pending();
		if (!admitted && !this.admit(caller, waitInline)) return pending();
		const run = this.refresh(caller.tenantId, href).finally(() => this.inFlight.delete(key));
		this.inFlight.set(key, run);
		if (waitInline) return run;
		void run.catch(() => undefined);
		return pending();
	}

	/**
	 * Admits a fetch against the caller's budget: true when it may start. A first fetch over the budget is refused with
	 * 429; a refresh over it is simply not made (the stale preview is served).
	 */
	private admit(caller: IChatCaller, waitInline: boolean): boolean {
		if (this.spendFetch(caller)) return true;
		if (waitInline) throw new HttpException('Too many link previews were asked for; ask again in a minute.', HttpStatus.TOO_MANY_REQUESTS);
		return false;
	}

	/** Whether a fetch of this tenant and link was queued within the pending time (and forgets the old ones). */
	private recentlyQueued(key: string): boolean {
		const now = Date.now();
		const at = this.queuedAt.get(key);
		if (this.queuedAt.size > 10_000) {
			for (const [queued, when] of this.queuedAt) if (now - when >= CHAT_LINK_PREVIEW_PENDING_TTL_MS) this.queuedAt.delete(queued);
		}
		return at !== undefined && now - at < CHAT_LINK_PREVIEW_PENDING_TTL_MS;
	}

	/** Writes the row of a tenant and link: updated when it is there, created when not (a racing creation updated). */
	private async store(
		tenantId: ID,
		href: string,
		values: { status: ChatLinkPreviewStatusEnum; data?: string | null; fetchedAt?: Date }
	): Promise<void> {
		const repository = this.repository();
		const urlHash = previewUrlHash(href);
		const changes = { ...values, url: href, updatedAt: new Date() };
		const updated = await repository.update({ tenantId, urlHash }, changes);
		if (updated.affected) return;
		try {
			await repository.save(repository.create({ tenantId, urlHash, ...changes }));
		} catch (error) {
			// Another ask created it first (the unique key refused this one): that row takes the values.
			if (!(await repository.findOne({ where: { tenantId, urlHash } }))) throw error;
			await repository.update({ tenantId, urlHash }, changes);
		}
	}

	private repository() {
		return this.dataSource.getRepository(ChatLinkPreview);
	}
}

/** An answer with no preview fields. */
function answer(url: string, status: ChatLinkPreviewStatusEnum): IChatLinkPreview {
	return { url, status };
}

/** The picture a cached row's preview names, when the row is `ready` and its data reads back. */
export function imageOfRow(row: Pick<ChatLinkPreview, 'status' | 'data'> | null): string | null {
	if (!row || row.status !== ChatLinkPreviewStatusEnum.READY) return null;
	try {
		const data = JSON.parse(String(row.data ?? '')) as ILinkPreviewData;
		return data && typeof data.image === 'string' && data.image ? data.image : null;
	} catch {
		return null;
	}
}

/** The answer a cached row gives: its fields when it is `ready` and its data reads back, else "unavailable". */
function fromRow(url: string, row: ChatLinkPreview): IChatLinkPreview {
	const fetchedAt = row.fetchedAt ?? null;
	if (row.status !== ChatLinkPreviewStatusEnum.READY) return { url, status: row.status, fetchedAt };
	try {
		const data = JSON.parse(String(row.data ?? '')) as ILinkPreviewData;
		if (data && typeof data === 'object') return { ...pick(data), url, status: ChatLinkPreviewStatusEnum.READY, fetchedAt };
	} catch {
		// Unreadable data: no preview.
	}
	return { url, status: ChatLinkPreviewStatusEnum.UNAVAILABLE, fetchedAt };
}

/** The preview fields of stored data, and nothing else. */
function pick(data: ILinkPreviewData): ILinkPreviewData {
	const out: ILinkPreviewData = {};
	for (const key of ['title', 'description', 'siteName', 'image', 'imageAlt', 'icon'] as const) {
		if (typeof data[key] === 'string') out[key] = data[key];
	}
	for (const key of ['imageWidth', 'imageHeight'] as const) {
		if (typeof data[key] === 'number') out[key] = data[key];
	}
	return out;
}
