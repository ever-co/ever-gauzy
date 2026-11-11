import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { ChatLinkPreviewStatusEnum, IChatLinkPreview } from '@gauzy/contracts';
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
 * - 404 for a preview: the platform's previews are off; 404 for a picture: its pictures are off (or it has none for
 *   that link). Nothing more of that kind is asked this session, after the first 404 of the pictures route for a link
 *   with a ready picture.
 */
@Injectable({ providedIn: 'root' })
export class ChatLinkPreviewsService {
	private readonly api = inject(ChatUiService);
	private readonly previews = new Map<string, WritableSignal<ChatLinkPreviewText | null>>();
	private readonly waiting: Ask[] = [];
	private running = 0;
	/** Set once the platform answered 404: its link previews are off. */
	private off = false;
	/** Set once the pictures route answered 404: the platform serves no pictures. */
	private imagesOff = false;

	/**
	 * The preview text of a link: `null` until (and unless) the platform has one. The first call for a link asks for
	 * it; every later call answers the same signal. Safe to call while a template or a `computed` is read: the ask
	 * starts on a microtask, never during the read.
	 */
	preview(url: string): Signal<ChatLinkPreviewText | null> {
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

	private ask({ url, attempt }: Ask): void {
		const done = this.started();
		this.api.linkPreview(url).subscribe({
			next: (answer) => {
				const text = answer?.status === ChatLinkPreviewStatusEnum.READY ? textOf(answer) : null;
				if (text) {
					this.previews.get(url)?.set(text);
					if (answer.image && !this.imagesOff) this.waiting.push({ url, attempt: 0, kind: 'image' });
				}
				if (answer?.status === ChatLinkPreviewStatusEnum.PENDING) this.retry({ url, attempt, kind: 'preview' });
				done();
			},
			error: (error: unknown) => {
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

	private askImage({ url, attempt }: Ask): void {
		const done = this.started();
		this.api.linkPreviewImage(url).subscribe({
			next: (blob) => {
				const preview = this.previews.get(url);
				const current = preview?.();
				if (preview && current && blob?.size) {
					preview.set({ ...current, imageUrl: URL.createObjectURL(blob) });
				}
				done();
			},
			error: (error: unknown) => {
				if (error instanceof HttpErrorResponse && error.status === 404) {
					// No picture for this link, or the platform serves none: the card stays text. The pictures route
					// answers 404 for every link while its switch is off, so a 404 for a link whose preview names a picture
					// stops the picture asks for the session.
					this.imagesOff = true;
				} else if (isPassing(error)) {
					this.retry({ url, attempt, kind: 'image' });
				}
				done();
			},
			complete: done
		});
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
		setTimeout(() => {
			if (this.off) return;
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
