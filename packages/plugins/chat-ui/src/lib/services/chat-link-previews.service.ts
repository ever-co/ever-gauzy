import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, type Signal, signal, type WritableSignal } from '@angular/core';
import { ChatLinkPreviewStatusEnum, IChatLinkPreview } from '@gauzy/contracts';
import { ChatAvailabilityService } from './chat-availability.service';
import { ChatUiService } from './chat-ui.service';

/** What a link card shows of a preview: the page's own words, as text, and its picture once the platform served it. */
export interface ChatLinkPreviewText {
	siteName: string | null;
	title: string | null;
	description: string | null;
	/** A `blob:` URL of the picture the platform served (never the linked site's own address), or null. */
	imageUrl?: string | null;
	imageAlt?: string | null;
}

/** How many previews are asked for at once, and how a `pending` one is asked for again. */
export const CHAT_LINK_PREVIEW_CONCURRENCY = 4;
export const CHAT_LINK_PREVIEW_RETRY_MS = 2000;
export const CHAT_LINK_PREVIEW_RETRIES = 3;
/**
 * The pictures kept in the page (as `blob:` URLs): at most this many and this many bytes, the least recently shown
 * released first (its URL revoked, its card back to text).
 */
export const CHAT_LINK_PREVIEW_PICTURES_MAX = 60;
export const CHAT_LINK_PREVIEW_PICTURE_BYTES_MAX = 24 * 1024 * 1024;

type Ask = { url: string; attempt: number; kind: 'preview' | 'image' };

/**
 * The previews of the links messages show (`GET /chat/link-preview`), for the link cards: asked once per link per
 * session, a few at a time, and kept. The platform fetches the page; the reader's browser never does.
 *
 * - `ready` with a title or a description: the card shows them. When the preview names a picture, the picture is asked
 *   of the platform too (`GET /chat/link-preview/image`, which serves it from its own fetch) and shown once it came. The
 *   card never points the browser at the linked site's picture or icon (the site would learn who read the link).
 * - `pending`, or a failure that may pass (no connection, 429, 5xx): asked again after 2, 4 and 6 seconds, then given
 *   up on; the card stays as it is meanwhile.
 * - `unavailable`, another refusal: the card stays as it is (the link alone).
 * - 404 for a preview: the platform's previews are off; 404 for a picture: its pictures are off. Nothing more of that
 *   kind is asked until the person or the organization changes. A link with no picture to serve answers 204: that link
 *   only stays text.
 *
 * Everything is kept per person and organization (the chat's scope): when either changes, the previews and pictures
 * kept are dropped (their `blob:` URLs revoked), the switches read again, and answers still on their way for the old
 * scope are not applied.
 */
@Injectable({ providedIn: 'root' })
export class ChatLinkPreviewsService {
	private readonly api = inject(ChatUiService);
	private readonly availability = inject(ChatAvailabilityService);
	/** Counts the scopes seen: an answer to an ask of an earlier one is dropped. */
	private generation = 0;
	private readonly previews = new Map<string, WritableSignal<ChatLinkPreviewText | null>>();
	private readonly waiting: Ask[] = [];
	private running = 0;
	/** Set once the platform answered 404: its link previews are off. */
	private off = false;
	/** Set once the pictures route answered 404: the platform serves no pictures. */
	private imagesOff = false;
	/** The pictures kept, by link, the least recently shown first (a `Map` keeps insertion order). */
	private readonly pictures = new Map<string, { objectUrl: string; bytes: number }>();
	private pictureBytes = 0;

	constructor() {
		// The service lives as long as the app: so does this subscription.
		this.availability.scope$.subscribe(() => this.reset());
	}

	/**
	 * The preview text of a link: `null` until (and unless) the platform has one. The first call for a link asks for
	 * it; every later call answers the same signal. Safe to call while a template or a `computed` is read: the ask
	 * starts on a microtask, never during the read.
	 */
	preview(url: string): Signal<ChatLinkPreviewText | null> {
		this.touchPicture(url);
		let preview = this.previews.get(url);
		if (!preview) {
			preview = signal<ChatLinkPreviewText | null>(null);
			this.previews.set(url, preview);
			if (!this.off) {
				this.waiting.push({ url, attempt: 0, kind: 'preview' });
				queueMicrotask(() => this.next());
			}
		}
		return preview.asReadonly();
	}

	/** Starts the next asks, as many as may run at once. */
	private next(): void {
		while (!this.off && this.running < CHAT_LINK_PREVIEW_CONCURRENCY && this.waiting.length) {
			const ask = this.waiting.shift()!;
			if (ask.kind === 'image') {
				if (!this.imagesOff) this.askImage(ask);
			} else {
				this.ask(ask);
			}
		}
	}

	/** Asks the platform for a link's preview, and applies the answer to its card (in the scope it was asked in). */
	private ask({ url, attempt }: Ask): void {
		const done = this.started();
		const generation = this.generation;
		this.api.linkPreview(url).subscribe({
			next: (answer) => {
				if (generation !== this.generation) return done();
				const text = answer?.status === ChatLinkPreviewStatusEnum.READY ? textOf(answer) : null;
				if (text) {
					this.previews.get(url)?.set(text);
					if (answer.image && !this.imagesOff) this.waiting.push({ url, attempt: 0, kind: 'image' });
				}
				if (answer?.status === ChatLinkPreviewStatusEnum.PENDING) this.retry({ url, attempt, kind: 'preview' });
				done();
			},
			error: (error: unknown) => {
				if (generation !== this.generation) return done();
				if (error instanceof HttpErrorResponse && error.status === 404) {
					// The platform's previews are off: nothing more is asked this session.
					this.off = true;
					this.waiting.length = 0;
				} else if (isPassing(error)) {
					// A failure that may pass (no connection, too many asks, the server busy): asked again, a little later each time.
					this.retry({ url, attempt, kind: 'preview' });
				}
				done();
			},
			complete: done
		});
	}

	/** Asks the platform for a preview's picture, and shows it on the card from a `blob:` URL of the answer. */
	private askImage({ url, attempt }: Ask): void {
		const done = this.started();
		const generation = this.generation;
		this.api.linkPreviewImage(url).subscribe({
			next: (blob) => {
				if (generation !== this.generation) return done();
				// No body (204): this link has no picture to serve; the card stays text.
				const preview = this.previews.get(url);
				const current = preview?.();
				if (preview && current && blob?.size) {
					const objectUrl = URL.createObjectURL(blob);
					preview.set({ ...current, imageUrl: objectUrl });
					this.keepPicture(url, objectUrl, blob.size);
				}
				done();
			},
			error: (error: unknown) => {
				if (generation !== this.generation) return done();
				if (error instanceof HttpErrorResponse && error.status === 404) {
					// The platform serves no pictures (its switch is off): none is asked for again in this scope.
					this.imagesOff = true;
				} else if (isPassing(error)) {
					this.retry({ url, attempt, kind: 'image' });
				}
				done();
			},
			complete: done
		});
	}

	/** Keeps a picture, releasing the least recently shown ones while too many, or too many bytes, are kept. */
	private keepPicture(url: string, objectUrl: string, bytes: number): void {
		this.releasePicture(url);
		this.pictures.set(url, { objectUrl, bytes });
		this.pictureBytes += bytes;
		for (const oldest of this.pictures.keys()) {
			if (this.pictures.size <= CHAT_LINK_PREVIEW_PICTURES_MAX && this.pictureBytes <= CHAT_LINK_PREVIEW_PICTURE_BYTES_MAX) break;
			if (oldest !== url) this.releasePicture(oldest);
		}
	}

	/** A card shows a link's preview again: its picture is the most recently shown. */
	private touchPicture(url: string): void {
		const picture = this.pictures.get(url);
		if (!picture) return;
		this.pictures.delete(url);
		this.pictures.set(url, picture);
	}

	/** Releases a picture: its URL revoked, its card back to text. */
	private releasePicture(url: string): void {
		const picture = this.pictures.get(url);
		if (!picture) return;
		this.pictures.delete(url);
		this.pictureBytes -= picture.bytes;
		URL.revokeObjectURL(picture.objectUrl);
		const preview = this.previews.get(url);
		const current = preview?.();
		if (preview && current?.imageUrl === picture.objectUrl) preview.set({ ...current, imageUrl: null });
	}

	/**
	 * Drops everything kept for the scope that ended (previews, pictures and their `blob:` URLs, the asks waiting) and
	 * reads the switches again; an answer already on its way is dropped when it comes (`generation`).
	 */
	private reset(): void {
		this.generation++;
		for (const url of [...this.pictures.keys()]) this.releasePicture(url);
		this.previews.clear();
		this.waiting.length = 0;
		this.off = false;
		this.imagesOff = false;
	}

	/** Counts an ask as running; answers the function that counts it done (once). */
	private started(): () => void {
		this.running++;
		let settled = false;
		return () => {
			if (settled) return;
			settled = true;
			this.running--;
			this.next();
		};
	}

	/** Asks again later (each time a little later), while there are asks left. */
	private retry(ask: Ask): void {
		if (ask.attempt >= CHAT_LINK_PREVIEW_RETRIES) return;
		const generation = this.generation;
		setTimeout(() => {
			if (this.off || generation !== this.generation) return;
			this.waiting.push({ ...ask, attempt: ask.attempt + 1 });
			this.next();
		}, CHAT_LINK_PREVIEW_RETRY_MS * (ask.attempt + 1));
	}
}

/** Whether a failed ask may succeed later: no connection, too many asks, the server busy. */
function isPassing(error: unknown): boolean {
	return error instanceof HttpErrorResponse && (error.status === 0 || error.status === 429 || error.status >= 500);
}

/** The text of a ready preview a card shows, or null when it has neither a title nor a description. */
export function textOf(preview: IChatLinkPreview): ChatLinkPreviewText | null {
	const clean = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
	const title = clean(preview.title);
	const description = clean(preview.description);
	if (!title && !description) return null;
	return { siteName: clean(preview.siteName), title, description, imageUrl: null, imageAlt: clean(preview.imageAlt) };
}
