import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChatLinkPreview } from '../entities/chat-link-preview.entity';
import type { IChatCaller } from '../services/chat-access.service';
import {
	CHAT_LINK_PREVIEW_IMAGE_CACHE_BYTES,
	CHAT_LINK_PREVIEW_IMAGE_CACHE_ENTRIES,
	CHAT_LINK_PREVIEW_IMAGE_CONCURRENCY,
	CHAT_LINK_PREVIEW_IMAGE_FAILURE_TTL_MS,
	CHAT_LINK_PREVIEW_IMAGE_TTL_MS
} from './chat-link-preview.constants';
import { CHAT_LINK_PREVIEW_OPTIONS, ChatLinkPreviewService, IChatLinkPreviewOptions, imageOfRow } from './chat-link-preview.service';
import { fetchPreviewImage, LinkPreviewImageOutcome } from './link-preview-image';
import { LinkPreviewUrlError, normalizePreviewUrl, previewUrlHash } from './link-preview-url';

/** A preview's picture, as the route serves it. */
export interface IChatLinkPreviewImage {
	type: string;
	body: Buffer;
}

/** The fetch of a picture. A seam: the server uses `fetchPreviewImage`, specs answer without a network. */
export type ChatLinkPreviewImageFetcher = (url: string) => Promise<LinkPreviewImageOutcome>;
export const CHAT_LINK_PREVIEW_IMAGE_FETCHER = 'CHAT_LINK_PREVIEW_IMAGE_FETCHER';

interface ICachedImage {
	/** The picture URL the preview named when it was fetched (a refreshed preview naming another fetches again). */
	image: string;
	picture: IChatLinkPreviewImage | null;
	until: number;
}

/**
 * The pictures of link previews, served by the platform (`GET /chat/link-preview/image?url=`, chat task T30), so a
 * client can show a preview's picture without the reader's browser loading it from the linked site.
 *
 * A picture is served only for a link whose preview the tenant's cache holds as `ready` and names a picture: the route
 * is never a way to fetch an arbitrary address. The picture is fetched through the egress guard
 * (`fetchPreviewImage`), taken only as PNG, JPEG, GIF, WebP or AVIF by its bytes and at most 1 MiB, and kept in a
 * per-process cache (a day; a picture that could not be fetched is not asked for again for ten minutes), at most
 * `CHAT_LINK_PREVIEW_IMAGE_CACHE_ENTRIES` pictures and `CHAT_LINK_PREVIEW_IMAGE_CACHE_BYTES` in all, the least recently
 * served dropped first. A fetch spends from the same per-person budget as the previews, and at most
 * `CHAT_LINK_PREVIEW_IMAGE_CONCURRENCY` run at once in a process (the bytes a running one holds count against no cache):
 * beyond that the route answers 503, which a client asks again after a moment.
 */
@Injectable()
export class ChatLinkPreviewImageService {
	private readonly fetcher: ChatLinkPreviewImageFetcher;
	/** By tenant and link, in the order last served (a `Map` keeps insertion order). */
	private readonly cache = new Map<string, ICachedImage>();
	private cachedBytes = 0;
	private readonly inFlight = new Map<string, Promise<IChatLinkPreviewImage | null>>();

	constructor(
		private readonly dataSource: DataSource,
		@Inject(CHAT_LINK_PREVIEW_OPTIONS) private readonly options: IChatLinkPreviewOptions,
		private readonly previews: ChatLinkPreviewService,
		@Optional() @Inject(CHAT_LINK_PREVIEW_IMAGE_FETCHER) fetcher?: ChatLinkPreviewImageFetcher
	) {
		this.fetcher = fetcher ?? ((url) => fetchPreviewImage(url));
	}

	/**
	 * The picture of a link's preview, for a caller of the chat routes, or null when there is none to serve: no ready
	 * preview of the link, no picture named, or a picture that could not be fetched. (The route answers that 204, so a
	 * client tells "no picture for this link" from "no pictures at all", which is 404.)
	 *
	 * @throws NotFoundException while the pictures (or the previews) are off; BadRequestException for a value that is
	 * not an http(s) link; 429 when the caller's fetch budget is spent; 503 when too many pictures are being fetched.
	 */
	async image(caller: IChatCaller, raw: string): Promise<IChatLinkPreviewImage | null> {
		if (!this.options.enabled || !this.options.images) throw new NotFoundException('The requested record was not found');
		let href: string;
		try {
			href = normalizePreviewUrl(raw).href;
		} catch (error) {
			if (error instanceof LinkPreviewUrlError) throw new BadRequestException(error.message);
			throw error;
		}
		const urlHash = previewUrlHash(href);
		const row = await this.dataSource.getRepository(ChatLinkPreview).findOne({ where: { tenantId: caller.tenantId, urlHash } });
		const image = imageOfRow(row);
		if (!image) return null;

		const key = `${caller.tenantId}:${urlHash}`;
		const cached = this.cache.get(key);
		if (cached && cached.image === image && cached.until > Date.now()) {
			this.touch(key, cached);
			return cached.picture;
		}
		// Shared by link and picture: a refreshed preview that names another picture does not join the old one's fetch.
		const fetchKey = `${key}|${image}`;
		let running = this.inFlight.get(fetchKey);
		if (!running) {
			if (this.inFlight.size >= CHAT_LINK_PREVIEW_IMAGE_CONCURRENCY) {
				throw new ServiceUnavailableException('Too many link preview pictures are being fetched; ask again in a moment.');
			}
			if (!this.previews.spendFetch(caller)) {
				throw new HttpException('Too many link previews were asked for; ask again in a minute.', HttpStatus.TOO_MANY_REQUESTS);
			}
			running = this.fetchAndKeep(key, image).finally(() => this.inFlight.delete(fetchKey));
			this.inFlight.set(fetchKey, running);
		}
		return running;
	}

	/** Fetches a picture and keeps what came of it: the picture for a day, a failure for ten minutes. Never throws. */
	private async fetchAndKeep(key: string, image: string): Promise<IChatLinkPreviewImage | null> {
		let outcome: LinkPreviewImageOutcome;
		try {
			outcome = await this.fetcher(image);
		} catch {
			outcome = { ok: false, reason: 'error' };
		}
		const picture = outcome.ok ? { type: outcome.type, body: outcome.body } : null;
		this.keep(key, { image, picture, until: Date.now() + (picture ? CHAT_LINK_PREVIEW_IMAGE_TTL_MS : CHAT_LINK_PREVIEW_IMAGE_FAILURE_TTL_MS) });
		return picture;
	}

	/** Keeps an entry, the least recently served ones dropped while the cache holds too many or too much. */
	private keep(key: string, entry: ICachedImage): void {
		this.drop(key);
		this.cache.set(key, entry);
		this.cachedBytes += entry.picture?.body.length ?? 0;
		for (const oldest of this.cache.keys()) {
			if (this.cache.size <= CHAT_LINK_PREVIEW_IMAGE_CACHE_ENTRIES && this.cachedBytes <= CHAT_LINK_PREVIEW_IMAGE_CACHE_BYTES) break;
			if (oldest === key) continue;
			this.drop(oldest);
		}
	}

	/** Marks an entry the most recently served. */
	private touch(key: string, entry: ICachedImage): void {
		this.cache.delete(key);
		this.cache.set(key, entry);
	}

	/** Drops an entry and the bytes it held. */
	private drop(key: string): void {
		const entry = this.cache.get(key);
		if (!entry) return;
		this.cachedBytes -= entry.picture?.body.length ?? 0;
		this.cache.delete(key);
	}

	/** How many pictures, and how many bytes, the cache holds (specs). */
	get cacheSize(): { entries: number; bytes: number } {
		return { entries: this.cache.size, bytes: this.cachedBytes };
	}
}

