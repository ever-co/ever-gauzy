/**
 * The preview pictures the platform serves (chat T30): only for a link whose ready preview names a picture, through the
 * picture fetch, kept in a bounded per-process cache, on the same per-person budget as the previews.
 *
 * `@gauzy/core` and `@gauzy/scheduler` are doubled at the module boundary, as in the preview service's spec.
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	return {
		__esModule: true,
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {}
	};
});
jest.mock('@gauzy/scheduler', () => ({ SchedulerQueueService: class SchedulerQueueService {} }));

import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChatLinkPreviewStatusEnum } from '@gauzy/contracts';
import type { IChatCaller } from '../services/chat-access.service';
import { CHAT_LINK_PREVIEW_IMAGE_CACHE_ENTRIES, CHAT_LINK_PREVIEW_IMAGE_CONCURRENCY, CHAT_LINK_PREVIEW_IMAGE_FAILURE_TTL_MS } from './chat-link-preview.constants';
import { ChatLinkPreviewImageFetcher, ChatLinkPreviewImageService } from './chat-link-preview-image.service';
import { ChatLinkPreviewService } from './chat-link-preview.service';
import { previewUrlHash } from './link-preview-url';

const LINK = 'https://www.example.com/post';
const IMAGE = 'https://cdn.example.com/cover.png';
const PICTURE = Buffer.from('picture-bytes');
const caller = (tenantId = 'tenant-a', userId = 'u1'): IChatCaller => ({ tenantId, organizationId: 'org', userId, employeeId: 'e1', canManage: false });

function setup(options: { images?: boolean; enabled?: boolean; fetcher?: ChatLinkPreviewImageFetcher; budget?: boolean } = {}) {
	const rows: Array<{ tenantId: string; urlHash: string; status: ChatLinkPreviewStatusEnum; data: string }> = [];
	const ready = (link: string, image: string | null, tenantId = 'tenant-a') =>
		rows.push({ tenantId, urlHash: previewUrlHash(link), status: ChatLinkPreviewStatusEnum.READY, data: JSON.stringify(image ? { title: 'T', image } : { title: 'T' }) });
	const repository = {
		findOne: jest.fn(async ({ where }: { where: { tenantId: string; urlHash: string } }) => rows.find((row) => row.tenantId === where.tenantId && row.urlHash === where.urlHash) ?? null)
	};
	const previews = { spendFetch: jest.fn(() => options.budget ?? true) } as unknown as ChatLinkPreviewService;
	const fetcher = jest.fn(options.fetcher ?? (async () => ({ ok: true as const, type: 'image/png', body: PICTURE })));
	const service = new ChatLinkPreviewImageService(
		{ getRepository: () => repository } as unknown as DataSource,
		{ enabled: options.enabled ?? true, queued: false, images: options.images ?? true },
		previews,
		fetcher
	);
	return { service, rows, ready, fetcher, previews };
}

describe('ChatLinkPreviewImageService', () => {
	it('answers 404 while the pictures or the previews are off', async () => {
		for (const off of [{ images: false }, { enabled: false }]) {
			const { service, ready, fetcher } = setup(off);
			ready(LINK, IMAGE);
			await expect(service.image(caller(), LINK)).rejects.toBeInstanceOf(NotFoundException);
			expect(fetcher).not.toHaveBeenCalled();
		}
	});

	it('serves only the picture a ready preview of the tenant names: never an address the caller chose', async () => {
		const { service, ready, fetcher } = setup();
		ready('https://www.example.com/no-picture', null);
		ready(LINK, IMAGE, 'tenant-b');
		// No picture to serve (the route answers 204, not the 404 of the switch being off).
		await expect(service.image(caller(), 'https://www.example.com/no-picture')).resolves.toBeNull();
		await expect(service.image(caller(), 'https://www.example.com/never-previewed')).resolves.toBeNull();
		// Another tenant's preview is not this tenant's.
		await expect(service.image(caller('tenant-a'), LINK)).resolves.toBeNull();
		expect(fetcher).not.toHaveBeenCalled();

		await expect(service.image(caller('tenant-b'), LINK)).resolves.toEqual({ type: 'image/png', body: PICTURE });
		expect(fetcher).toHaveBeenCalledWith(IMAGE);
	});

	it('keeps what it served: asked again, the picture comes from the cache; two asks at once share a fetch', async () => {
		const { service, ready, fetcher } = setup();
		ready(LINK, IMAGE);
		const [first, second] = await Promise.all([service.image(caller(), LINK), service.image(caller(), LINK)]);
		expect(first).toEqual(second);
		await service.image(caller(), `${LINK}#again`);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('has no picture for one that could not be fetched, and does not ask for it again for a while', async () => {
		const { service, ready, fetcher } = setup({ fetcher: async () => ({ ok: false, reason: 'type' }) });
		ready(LINK, IMAGE);
		await expect(service.image(caller(), LINK)).resolves.toBeNull();
		await expect(service.image(caller(), LINK)).resolves.toBeNull();
		expect(fetcher).toHaveBeenCalledTimes(1);

		jest.useFakeTimers({ now: Date.now() + CHAT_LINK_PREVIEW_IMAGE_FAILURE_TTL_MS + 1000, doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate'] });
		try {
			await expect(service.image(caller(), LINK)).resolves.toBeNull();
			expect(fetcher).toHaveBeenCalledTimes(2);
		} finally {
			jest.useRealTimers();
		}
	});

	it('spends from the budget of the caller for a fetch only, and answers 429 when it is spent', async () => {
		const { service, ready, previews, fetcher } = setup({ budget: false });
		ready(LINK, IMAGE);
		await expect(service.image(caller(), LINK)).rejects.toMatchObject({ status: 429 });
		expect(previews.spendFetch).toHaveBeenCalledTimes(1);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('fetches a few pictures at once at most, and answers 503 beyond that', async () => {
		const { service, ready } = setup({ fetcher: () => new Promise(() => undefined) });
		const links = Array.from({ length: CHAT_LINK_PREVIEW_IMAGE_CONCURRENCY + 1 }, (_, n) => `https://www.example.com/slow/${n}`);
		links.forEach((link) => ready(link, IMAGE));
		for (const link of links.slice(0, CHAT_LINK_PREVIEW_IMAGE_CONCURRENCY)) void service.image(caller(), link);
		await new Promise((resolve) => setImmediate(resolve));
		await expect(service.image(caller(), links[links.length - 1])).rejects.toMatchObject({ status: 503 });
	});

	it('does not hand a refreshed preview the picture its old one named', async () => {
		let finishOld: () => void = () => undefined;
		const fetcher: ChatLinkPreviewImageFetcher = async (url) => {
			if (url === IMAGE) await new Promise<void>((resolve) => (finishOld = resolve));
			return { ok: true, type: 'image/png', body: Buffer.from(url) };
		};
		const { service, rows, ready } = setup({ fetcher });
		ready(LINK, IMAGE);
		const old = service.image(caller(), LINK);
		await new Promise((resolve) => setImmediate(resolve));
		// The preview was refreshed meanwhile and names another picture.
		rows[0].data = JSON.stringify({ title: 'T', image: 'https://cdn.example.com/new.png' });
		await expect(service.image(caller(), LINK)).resolves.toEqual({ type: 'image/png', body: Buffer.from('https://cdn.example.com/new.png') });
		finishOld();
		await expect(old).resolves.toEqual({ type: 'image/png', body: Buffer.from(IMAGE) });
	});

	it('holds a bounded number of pictures, the least recently served dropped first', async () => {
		const { service, ready, fetcher } = setup();
		const links = Array.from({ length: CHAT_LINK_PREVIEW_IMAGE_CACHE_ENTRIES + 1 }, (_, n) => `https://www.example.com/${n}`);
		links.forEach((link) => ready(link, IMAGE));
		for (const link of links) await service.image(caller(), link);
		expect(service.cacheSize.entries).toBe(CHAT_LINK_PREVIEW_IMAGE_CACHE_ENTRIES);
		expect(service.cacheSize.bytes).toBe(CHAT_LINK_PREVIEW_IMAGE_CACHE_ENTRIES * PICTURE.length);
		// The first one served was dropped: asked again, it is fetched again; the last one is still kept.
		await service.image(caller(), links[links.length - 1]);
		expect(fetcher).toHaveBeenCalledTimes(links.length);
		await service.image(caller(), links[0]);
		expect(fetcher).toHaveBeenCalledTimes(links.length + 1);
	});
});
