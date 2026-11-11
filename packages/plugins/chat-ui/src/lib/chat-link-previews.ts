import { asyncScheduler, defer, Observable, of, ReplaySubject, SchedulerLike, Subject, timer } from 'rxjs';
import { catchError, defaultIfEmpty, shareReplay, switchMap, take, takeUntil } from 'rxjs/operators';

/** Where the platform stands on a link: still being fetched, read, or nothing to show (private host, no page, refused). */
export type ChatLinkPreviewStatus = 'pending' | 'ready' | 'unavailable';

/**
 * A link's preview as the platform answers it (`GET /api/chat/link-preview?url=`), fetched and cached server side,
 * never by the reader's browser. The texts are plain text (shown as text, never as HTML); `image` and `icon` are
 * absolute `https` URLs. Kept here until `IChatLinkPreview` is in `@gauzy/contracts`.
 */
export interface ChatLinkPreview {
	url: string;
	status: ChatLinkPreviewStatus;
	title?: string | null;
	description?: string | null;
	siteName?: string | null;
	image?: string | null;
	imageAlt?: string | null;
	imageWidth?: number | null;
	imageHeight?: number | null;
	icon?: string | null;
	fetchedAt?: string | Date | null;
}

/** A refusal as the preview route answers it: the HTTP status (an `HttpErrorResponse` carries it). */
interface ErrorWithStatus {
	status?: number;
}

export interface ChatLinkPreviewTiming {
	/** How long after a `pending` answer the link is asked again. */
	pendingRetryMs: number;
	/** How many times a `pending` link is asked again before its card stays link-only. */
	pendingRetries: number;
}

export const CHAT_LINK_PREVIEW_TIMING: ChatLinkPreviewTiming = { pendingRetryMs: 2_000, pendingRetries: 3 };

/** Whether previews are served: not known before the first answer, then on, or off for the session (404). */
type Availability = 'unknown' | 'on' | 'off';

/** What the requests waiting for the probe learn: served or not, or that the probe failed for a passing reason. */
type ProbeOutcome = 'on' | 'off' | 'failed';

/** Only an absolute `https` URL is shown as an image or an icon (the platform sends no other; a second gate). */
export function safeHttpsUrl(value: string | null | undefined): string | null {
	if (typeof value !== 'string' || !value.trim()) return null;
	try {
		const url = new URL(value.trim());
		return url.protocol === 'https:' && !!url.hostname ? url.href : null;
	} catch {
		return null;
	}
}

/** The preview a card shows: only a `ready` answer with something to show, its image and icon kept only when safe. */
export function shownPreview(preview: ChatLinkPreview | null | undefined): ChatLinkPreview | null {
	if (!preview || preview.status !== 'ready') return null;
	const shown: ChatLinkPreview = {
		...preview,
		title: preview.title?.trim() || null,
		description: preview.description?.trim() || null,
		siteName: preview.siteName?.trim() || null,
		image: safeHttpsUrl(preview.image),
		icon: safeHttpsUrl(preview.icon)
	};
	return shown.title || shown.description || shown.image ? shown : null;
}

/** The `aspect-ratio` of a preview's image, from its size (none without one, then the card's box bounds it). */
export function imageAspectRatio(preview: Pick<ChatLinkPreview, 'imageWidth' | 'imageHeight'>): string | null {
	const width = Number(preview.imageWidth);
	const height = Number(preview.imageHeight);
	return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? `${Math.round(width)} / ${Math.round(height)}` : null;
}

/**
 * The link previews of the page: one request per distinct URL, shared by every message that holds it, kept for the
 * session (dropped with {@link reset} when the user or the organization changes).
 *
 * - The first request is the probe: until it answers, other links wait for it. A 404 means the platform does not serve
 *   previews (`GAUZY_CHAT_LINK_PREVIEWS_ENABLED` off, or no chat): nothing is asked again this session, and every card
 *   stays link-only, without an error.
 * - `pending` (the platform is fetching the page): asked again after {@link ChatLinkPreviewTiming.pendingRetryMs}, up to
 *   {@link ChatLinkPreviewTiming.pendingRetries} times; still pending after that, the card stays link-only.
 * - `unavailable`, or a 400 (not a link the platform previews): the card stays link-only, and the link is not asked
 *   again this session.
 * - Any other failure (throttled, the API away): this card stays link-only, and the link is asked again the next time a
 *   message shows it.
 */
export class ChatLinkPreviewCache {
	private availability: Availability = 'unknown';
	private probing = false;
	/** Counts the resets: an answer for an earlier user or organization changes nothing. */
	private generation = 0;
	private known = new ReplaySubject<ProbeOutcome>(1);
	private readonly entries = new Map<string, Observable<ChatLinkPreview | null>>();
	/** Ends every request and retry under way: on a reset, and when previews turn off. */
	private stop = new Subject<void>();

	constructor(
		private readonly fetch: (url: string) => Observable<ChatLinkPreview>,
		private readonly timing: ChatLinkPreviewTiming = CHAT_LINK_PREVIEW_TIMING,
		private readonly scheduler: SchedulerLike = asyncScheduler
	) {}

	/** Whether the platform answered that it serves no previews (404) this session. */
	get off(): boolean {
		return this.availability === 'off';
	}

	/**
	 * The preview of a link: emits it once it is `ready` (or null when there is none to show), then completes. Every
	 * caller of one URL shares one request.
	 */
	preview(url: string): Observable<ChatLinkPreview | null> {
		if (this.availability === 'off') return of(null);
		let entry = this.entries.get(url);
		if (!entry) {
			const generation = this.generation;
			entry = this.whenServed(generation).pipe(
				switchMap((outcome) => {
					if (outcome === 'on') return this.ask(url, 0, generation);
					// The probe failed for a passing reason: this card stays link-only, the next message asks again.
					if (outcome === 'failed') this.forget(url, generation);
					return of(null);
				}),
				// A reset or previews turning off ends the request or the retry under way: the card stays link-only.
				takeUntil(this.stop),
				defaultIfEmpty(null),
				shareReplay({ bufferSize: 1, refCount: false })
			);
			this.entries.set(url, entry);
		}
		return entry;
	}

	/** Forgets every preview and what the platform said (another user or organization). */
	reset(): void {
		this.stop.next();
		this.stop = new Subject<void>();
		this.generation += 1;
		this.availability = 'unknown';
		this.probing = false;
		this.known = new ReplaySubject<ProbeOutcome>(1);
		this.entries.clear();
	}

	/**
	 * Lets one request through as the probe while it is not known whether previews are served; the others wait for it.
	 * An entry made before a reset and subscribed after it asks nothing (it would probe for a session that is gone).
	 */
	private whenServed(generation: number): Observable<ProbeOutcome> {
		return defer(() => {
			if (generation !== this.generation) return of<ProbeOutcome>('off');
			if (this.availability === 'on') return of<ProbeOutcome>('on');
			if (this.availability === 'off') return of<ProbeOutcome>('off');
			if (!this.probing) {
				this.probing = true;
				// The requests that come while this probe runs wait for what it learns, and only for this one.
				this.known = new ReplaySubject<ProbeOutcome>(1);
				return of<ProbeOutcome>('on');
			}
			return this.known.pipe(take(1));
		});
	}

	private ask(url: string, attempt: number, generation: number): Observable<ChatLinkPreview | null> {
		// Nothing is asked for a session that is gone, or once previews are off (a retry that comes after either).
		const current = () => generation === this.generation && this.availability !== 'off';
		return defer(() => (current() ? this.fetch(url) : of(null))).pipe(
			switchMap((preview) => {
				if (!preview || !current()) return of(null);
				this.settle('on', generation);
				if (preview.status === 'pending') {
					return attempt < this.timing.pendingRetries
						? timer(this.timing.pendingRetryMs, this.scheduler).pipe(switchMap(() => this.ask(url, attempt + 1, generation)))
						: of(null);
				}
				return of(shownPreview(preview));
			}),
			catchError((error: ErrorWithStatus) => {
				const status = error?.status;
				if (status === 404) {
					this.settle('off', generation);
					return of(null);
				}
				if (status === 400) {
					// Answered: previews are served, this link is not one the platform previews.
					this.settle('on', generation);
					return of(null);
				}
				// A passing failure: this card stays link-only, the next message to show the link asks again; a probe
				// that failed so tells the ones waiting for it, and lets the next request probe.
				this.forget(url, generation);
				if (generation === this.generation && this.availability === 'unknown' && this.probing) {
					this.probing = false;
					this.known.next('failed');
				}
				return of(null);
			})
		);
	}

	private forget(url: string, generation: number): void {
		if (generation === this.generation) this.entries.delete(url);
	}

	private settle(availability: Exclude<Availability, 'unknown'>, generation: number): void {
		if (generation !== this.generation || this.availability === availability) return;
		if (this.availability === 'off') return;
		this.availability = availability;
		this.probing = false;
		this.known.next(availability);
		if (availability === 'off') {
			this.entries.clear();
			// Every other request and retry under way ends: nothing more is asked this session.
			this.stop.next();
		}
	}
}

