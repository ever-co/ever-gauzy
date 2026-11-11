import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { ChatLinkPreviewStatusEnum, IChatLinkPreview } from '@gauzy/contracts';
import { ChatUiService } from './chat-ui.service';

/** What a link card shows of a preview: the page's own words, as text. */
export interface ChatLinkPreviewText {
	siteName: string | null;
	title: string | null;
	description: string | null;
}

/** How many previews are asked for at once, and how a `pending` one is asked for again. */
export const CHAT_LINK_PREVIEW_CONCURRENCY = 4;
export const CHAT_LINK_PREVIEW_RETRY_MS = 2000;
export const CHAT_LINK_PREVIEW_RETRIES = 3;

/**
 * The previews of the links messages show (`GET /chat/link-preview`), for the link cards: asked once per link per
 * session, a few at a time, and kept. The platform fetches the page; the reader's browser never does. What a card
 * takes from a preview is text only (site, title, description): the picture and the icon a page names are left out,
 * since showing them would make the browser load them from the linked site (which would learn who read the link).
 *
 * - `ready` with a title or a description: the card shows them.
 * - `pending`: asked again after two seconds, three times at most; still pending, the card stays as it is.
 * - `unavailable`, a refusal, a failure: the card stays as it is (the link alone).
 * - 404: the platform's previews are off. Nothing more is asked this session.
 */
@Injectable({ providedIn: 'root' })
export class ChatLinkPreviewsService {
	private readonly api = inject(ChatUiService);
	private readonly previews = new Map<string, WritableSignal<ChatLinkPreviewText | null>>();
	private readonly waiting: Array<{ url: string; attempt: number }> = [];
	private running = 0;
	/** Set once the platform answered 404: its link previews are off. */
	private off = false;

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
				this.waiting.push({ url, attempt: 0 });
				queueMicrotask(() => this.next());
			}
		}
		return preview.asReadonly();
	}

	/** Starts the next asks, as many as may run at once. */
	private next(): void {
		while (!this.off && this.running < CHAT_LINK_PREVIEW_CONCURRENCY && this.waiting.length) {
			const { url, attempt } = this.waiting.shift()!;
			this.ask(url, attempt);
		}
	}

	private ask(url: string, attempt: number): void {
		this.running++;
		let settled = false;
		const done = () => {
			if (settled) return;
			settled = true;
			this.running--;
			this.next();
		};
		this.api.linkPreview(url).subscribe({
			next: (answer) => {
				const text = answer?.status === ChatLinkPreviewStatusEnum.READY ? textOf(answer) : null;
				if (text) this.previews.get(url)?.set(text);
				if (answer?.status === ChatLinkPreviewStatusEnum.PENDING && attempt < CHAT_LINK_PREVIEW_RETRIES) {
					setTimeout(() => {
						this.waiting.push({ url, attempt: attempt + 1 });
						this.next();
					}, CHAT_LINK_PREVIEW_RETRY_MS);
				}
				done();
			},
			error: (error: unknown) => {
				if (error instanceof HttpErrorResponse && error.status === 404) {
					// The platform's previews are off: nothing more is asked this session.
					this.off = true;
					this.waiting.length = 0;
				}
				done();
			},
			complete: done
		});
	}
}

/** The text of a ready preview a card shows, or null when it has neither a title nor a description. */
export function textOf(preview: IChatLinkPreview): ChatLinkPreviewText | null {
	const clean = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
	const title = clean(preview.title);
	const description = clean(preview.description);
	if (!title && !description) return null;
	return { siteName: clean(preview.siteName), title, description };
}
