import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { ChatLinkPreview, ChatLinkPreviewCache } from '../chat-link-previews';
import { ChatAvailabilityService } from './chat-availability.service';

/** The platform's preview route (`CHAT_VIEW`, the chat feature on, `GAUZY_CHAT_LINK_PREVIEWS_ENABLED=true`). */
export const CHAT_LINK_PREVIEW_URL = `${API_PREFIX}/chat/link-preview`;

/**
 * The link previews the cards under messages show (see {@link ChatLinkPreviewCache}): asked of the platform, which
 * fetches and caches the page server side (the reader's browser never fetches the linked page), one request per
 * distinct link for the page, dropped when the user or the organization changes. Where the platform does not serve
 * previews (404), every card stays the link-only card, without an error.
 */
@Injectable({ providedIn: 'root' })
export class ChatLinkPreviewService {
	private readonly http = inject(HttpClient);
	private readonly cache = new ChatLinkPreviewCache((url) =>
		this.http.get<ChatLinkPreview>(`${CHAT_LINK_PREVIEW_URL}?url=${encodeURIComponent(url)}`)
	);

	constructor() {
		inject(ChatAvailabilityService)
			.scope$.pipe(takeUntilDestroyed(inject(DestroyRef)))
			.subscribe(() => this.cache.reset());
	}

	/** The preview of a link once it is ready, or null when there is none to show. */
	preview(url: string): Observable<ChatLinkPreview | null> {
		return this.cache.preview(url);
	}
}
