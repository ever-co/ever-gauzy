/**
 * The preview route's service: the flag, the cache and its refresh policy, the inline and queued fetches.
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application; the entity only needs its
 * decorators), and so is `@gauzy/scheduler` (only its queue service's type is read). The fetch is a seam: no network.
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	return { __esModule: true, MultiORMColumn: decorator, MultiORMEntity: decorator, TenantOrganizationBaseEntity: class {}, MikroOrmBaseEntityRepository: class {} };
});
jest.mock('@gauzy/scheduler', () => ({
	SchedulerQueueService: class SchedulerQueueService {},
	QueueWorker: () => () => undefined,
	QueueJobHandler: () => () => undefined,
	QueueWorkerHost: class QueueWorkerHost {}
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChatLinkPreviewStatusEnum } from '@gauzy/contracts';
import type { SchedulerQueueService } from '@gauzy/scheduler';
import type { IChatCaller } from '../services/chat-access.service';
import {
	CHAT_LINK_PREVIEW_FETCH_JOB,
	CHAT_LINK_PREVIEW_PENDING_TTL_MS,
	CHAT_LINK_PREVIEW_QUEUE,
	CHAT_LINK_PREVIEW_READY_TTL_MS,
	CHAT_LINK_PREVIEW_UNAVAILABLE_TTL_MS
} from './chat-link-preview.constants';
import { ChatLinkPreviewFetcher, ChatLinkPreviewService, previewAction } from './chat-link-preview.service';
import { ChatLinkPreviewWorker } from './chat-link-preview.worker';
import { previewUrlHash } from './link-preview-url';

const LINK = 'https://www.example.com/post?id=7';
const PAGE = Buffer.from(
	'<html><head><title>Post</title><meta property="og:description" content="About it"><meta property="og:image" content="/cover.png"></head><body></body></html>'
);

const caller = (tenantId = 'tenant-a'): IChatCaller => ({ tenantId, organizationId: 'org', userId: 'u1', employeeId: 'e1', canManage: false });

interface Row {
	tenantId: string;
	urlHash: string;
	url?: string;
	status?: ChatLinkPreviewStatusEnum;
	data?: string | null;
	fetchedAt?: Date;
	updatedAt?: Date;
}

/** A repository of rows in memory, keyed like the table (tenant and link unique). */
function repository() {
	const rows: Row[] = [];
	const find = (where: { tenantId: string; urlHash: string }) => rows.find((row) => row.tenantId === where.tenantId && row.urlHash === where.urlHash);
	return {
		rows,
		findOne: jest.fn(async ({ where }: { where: { tenantId: string; urlHash: string } }) => find(where) ?? null),
		update: jest.fn(async (where: { tenantId: string; urlHash: string }, changes: Partial<Row>) => {
			const row = find(where);
			if (!row) return { affected: 0 };
			Object.assign(row, changes);
			return { affected: 1 };
		}),
		create: jest.fn((values: Row) => ({ ...values })),
		save: jest.fn(async (row: Row) => {
			if (find(row)) throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
			rows.push(row);
			return row;
		})
	};
}

function setup(options: { enabled?: boolean; queued?: boolean; queue?: Partial<SchedulerQueueService>; fetcher?: ChatLinkPreviewFetcher } = {}) {
	const repo = repository();
	const fetcher = jest.fn(options.fetcher ?? (async (url: string) => ({ ok: true as const, url, contentType: 'text/html', charset: null, body: PAGE })));
	const service = new ChatLinkPreviewService(
		{ getRepository: () => repo } as unknown as DataSource,
		{ enabled: options.enabled ?? true, queued: options.queued ?? false },
		fetcher,
		options.queue as SchedulerQueueService | undefined
	);
	return { service, repo, fetcher };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('ChatLinkPreviewService: the route', () => {
	it('answers 404 while previews are off, and fetches nothing', async () => {
		const { service, fetcher, repo } = setup({ enabled: false });
		await expect(service.preview(caller(), LINK)).rejects.toBeInstanceOf(NotFoundException);
		expect(fetcher).not.toHaveBeenCalled();
		expect(repo.findOne).not.toHaveBeenCalled();
	});

	it('answers 400 for a value that is not an http(s) link', async () => {
		const { service } = setup();
		for (const value of ['', 'not a link', 'ftp://example.com/', 'https://user:pass@example.com/', `https://example.com/${'a'.repeat(2100)}`]) {
			await expect(service.preview(caller(), value)).rejects.toBeInstanceOf(BadRequestException);
		}
	});

	it('answers "unavailable" for an internal host or a private address at once: nothing fetched or stored', async () => {
		const { service, fetcher, repo } = setup();
		for (const link of ['http://localhost/', 'http://10.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]/', 'http://redis:6379/', 'http://example.com:22/']) {
			await expect(service.preview(caller(), link)).resolves.toMatchObject({ status: ChatLinkPreviewStatusEnum.UNAVAILABLE });
		}
		expect(fetcher).not.toHaveBeenCalled();
		expect(repo.rows).toEqual([]);
	});
});

describe('ChatLinkPreviewService: inline (no queue root)', () => {
	it('fetches a link it has not seen, answers the preview and caches it for the tenant', async () => {
		const { service, fetcher, repo } = setup();
		const answer = await service.preview(caller(), `${LINK}#comments`);
		expect(answer).toMatchObject({
			url: LINK,
			status: ChatLinkPreviewStatusEnum.READY,
			title: 'Post',
			description: 'About it',
			image: 'https://www.example.com/cover.png'
		});
		expect(fetcher).toHaveBeenCalledWith(LINK);
		expect(repo.rows).toHaveLength(1);
		expect(repo.rows[0]).toMatchObject({ tenantId: 'tenant-a', urlHash: previewUrlHash(LINK), url: LINK, status: ChatLinkPreviewStatusEnum.READY });
		expect(JSON.parse(String(repo.rows[0].data))).toEqual({ title: 'Post', description: 'About it', image: 'https://www.example.com/cover.png' });

		// Fresh: served from the cache.
		await expect(service.preview(caller(), LINK)).resolves.toMatchObject({ status: ChatLinkPreviewStatusEnum.READY, title: 'Post' });
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('keeps tenants apart: another tenant asking for the same link fetches its own', async () => {
		const { service, fetcher, repo } = setup();
		await service.preview(caller('tenant-a'), LINK);
		await service.preview(caller('tenant-b'), LINK);
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(repo.rows.map((row) => row.tenantId)).toEqual(['tenant-a', 'tenant-b']);
	});

	it('lets two asks for the same link share one fetch', async () => {
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => (release = resolve));
		const { service, fetcher } = setup({
			fetcher: async (url) => {
				await gate;
				return { ok: true, url, contentType: 'text/html', charset: null, body: PAGE };
			}
		});
		const first = service.preview(caller(), LINK);
		const second = service.preview(caller(), LINK);
		await settle();
		release();
		const answers = await Promise.all([first, second]);
		expect(answers.map((answer) => answer.status)).toEqual([ChatLinkPreviewStatusEnum.READY, ChatLinkPreviewStatusEnum.READY]);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('stores a page that could not be fetched, or says nothing, as "unavailable", and tries it again only after its time', async () => {
		const { service, fetcher, repo } = setup({ fetcher: async () => ({ ok: false, reason: 'blocked' }) });
		await expect(service.preview(caller(), LINK)).resolves.toMatchObject({ status: ChatLinkPreviewStatusEnum.UNAVAILABLE });
		await expect(service.preview(caller(), LINK)).resolves.toMatchObject({ status: ChatLinkPreviewStatusEnum.UNAVAILABLE });
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(repo.rows[0]).toMatchObject({ status: ChatLinkPreviewStatusEnum.UNAVAILABLE, data: null });

		repo.rows[0].fetchedAt = new Date(Date.now() - CHAT_LINK_PREVIEW_UNAVAILABLE_TTL_MS - 1000);
		await service.preview(caller(), LINK);
		expect(fetcher).toHaveBeenCalledTimes(2);

		const empty = setup({ fetcher: async (url) => ({ ok: true, url, contentType: 'text/html', charset: null, body: Buffer.from('<html><head></head></html>') }) });
		await expect(empty.service.preview(caller(), LINK)).resolves.toMatchObject({ status: ChatLinkPreviewStatusEnum.UNAVAILABLE });
	});

	it('answers a fetch that threw as "unavailable"', async () => {
		const { service } = setup({
			fetcher: async () => {
				throw new Error('socket hang up');
			}
		});
		await expect(service.preview(caller(), LINK)).resolves.toMatchObject({ status: ChatLinkPreviewStatusEnum.UNAVAILABLE });
	});

	it('serves a stale preview at once and fetches it again behind it', async () => {
		const { service, fetcher, repo } = setup();
		await service.preview(caller(), LINK);
		repo.rows[0].fetchedAt = new Date(Date.now() - CHAT_LINK_PREVIEW_READY_TTL_MS - 1000);
		repo.rows[0].data = JSON.stringify({ title: 'Old title' });
		await expect(service.preview(caller(), LINK)).resolves.toMatchObject({ status: ChatLinkPreviewStatusEnum.READY, title: 'Old title' });
		await settle();
		await settle();
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(JSON.parse(String(repo.rows[0].data)).title).toBe('Post');
	});

	it('answers only the preview fields of what it stored', async () => {
		const { service, repo } = setup();
		repo.rows.push({
			tenantId: 'tenant-a',
			urlHash: previewUrlHash(LINK),
			url: LINK,
			status: ChatLinkPreviewStatusEnum.READY,
			data: JSON.stringify({ title: 'T', html: '<script>', imageWidth: '5', imageHeight: 10 }),
			fetchedAt: new Date()
		});
		const answer = await service.preview(caller(), LINK);
		expect(answer).toEqual({ url: LINK, status: ChatLinkPreviewStatusEnum.READY, title: 'T', imageHeight: 10, fetchedAt: repo.rows[0].fetchedAt });

		repo.rows[0].data = '{not json';
		await expect(service.preview(caller(), LINK)).resolves.toMatchObject({ status: ChatLinkPreviewStatusEnum.UNAVAILABLE });
	});

	it('answers "pending" instead of fetching when too many fetches run already', async () => {
		const { service, fetcher } = setup({ fetcher: () => new Promise(() => undefined) });
		for (let n = 0; n < 4; n++) void service.preview(caller(), `https://www.example.com/${n}`);
		await settle();
		await expect(service.preview(caller(), 'https://www.example.com/one-more')).resolves.toMatchObject({ status: ChatLinkPreviewStatusEnum.PENDING });
		expect(fetcher).toHaveBeenCalledTimes(4);
	});

	it('takes a row another ask created first (the unique key refused this one)', async () => {
		const { service, repo } = setup();
		const create = repo.save.getMockImplementation();
		repo.save.mockImplementationOnce(async (row: Row) => {
			// Another ask won the race: its row is there by the time this one inserts.
			repo.rows.push({ tenantId: row.tenantId, urlHash: row.urlHash, status: ChatLinkPreviewStatusEnum.PENDING });
			return create!(row);
		});
		await expect(service.preview(caller(), LINK)).resolves.toMatchObject({ status: ChatLinkPreviewStatusEnum.READY });
		expect(repo.rows).toHaveLength(1);
		expect(repo.rows[0].status).toBe(ChatLinkPreviewStatusEnum.READY);
	});
});

describe('ChatLinkPreviewService: queued', () => {
	it('marks a new link pending, queues one fetch job for the tenant and link, and answers "pending"', async () => {
		const enqueue = jest.fn(async () => undefined);
		const { service, fetcher, repo } = setup({ queued: true, queue: { enqueue } });
		await expect(service.preview(caller(), LINK)).resolves.toEqual({ url: LINK, status: ChatLinkPreviewStatusEnum.PENDING });
		expect(fetcher).not.toHaveBeenCalled();
		expect(repo.rows[0]).toMatchObject({ status: ChatLinkPreviewStatusEnum.PENDING, url: LINK });
		expect(enqueue).toHaveBeenCalledWith({
			queueName: CHAT_LINK_PREVIEW_QUEUE,
			jobName: CHAT_LINK_PREVIEW_FETCH_JOB,
			data: { tenantId: 'tenant-a', url: LINK },
			options: expect.objectContaining({ jobId: `chat-link-preview-tenant-a-${previewUrlHash(LINK)}`, removeOnComplete: true, removeOnFail: true })
		});
		// BullMQ refuses a custom id with a colon in it.
		expect((enqueue.mock.calls[0] as unknown as [{ options: { jobId: string } }])[0].options.jobId).not.toContain(':');

		// Still pending: waited for, not queued again.
		await expect(service.preview(caller(), LINK)).resolves.toMatchObject({ status: ChatLinkPreviewStatusEnum.PENDING });
		expect(enqueue).toHaveBeenCalledTimes(1);

		// A fetch that never reported back is queued again.
		repo.rows[0].updatedAt = new Date(Date.now() - CHAT_LINK_PREVIEW_PENDING_TTL_MS - 1000);
		await service.preview(caller(), LINK);
		expect(enqueue).toHaveBeenCalledTimes(2);
	});

	it('the worker fetches and stores what the job names, and the next ask is served', async () => {
		const enqueue = jest.fn(async () => undefined);
		const { service } = setup({ queued: true, queue: { enqueue } });
		await service.preview(caller(), LINK);
		const worker = new ChatLinkPreviewWorker(service);
		await worker.handleFetch({ data: { tenantId: 'tenant-a', url: LINK } } as never);
		await worker.handleFetch({ data: {} } as never);
		await expect(service.preview(caller(), LINK)).resolves.toMatchObject({ status: ChatLinkPreviewStatusEnum.READY, title: 'Post' });
	});

	it('fetches in the process when the queue refuses the job', async () => {
		const enqueue = jest.fn(async () => {
			throw new Error('Connection is closed.');
		});
		const { service, fetcher } = setup({ queued: true, queue: { enqueue } });
		await expect(service.preview(caller(), LINK)).resolves.toMatchObject({ status: ChatLinkPreviewStatusEnum.READY });
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
});

describe('previewAction', () => {
	const now = Date.UTC(2026, 10, 11, 12);
	const ago = (ms: number) => new Date(now - ms);

	it('fetches what it has no row for', () => {
		expect(previewAction(null, now)).toBe('fetch');
	});

	it('serves a ready preview until its time, then refreshes it while serving it', () => {
		expect(previewAction({ status: ChatLinkPreviewStatusEnum.READY, fetchedAt: ago(1000) }, now)).toBe('serve');
		expect(previewAction({ status: ChatLinkPreviewStatusEnum.READY, fetchedAt: ago(CHAT_LINK_PREVIEW_READY_TTL_MS + 1) }, now)).toBe('refresh');
		// A fetch time in the future (clocks apart) is not trusted.
		expect(previewAction({ status: ChatLinkPreviewStatusEnum.READY, fetchedAt: ago(-60_000) }, now)).toBe('refresh');
		expect(previewAction({ status: ChatLinkPreviewStatusEnum.READY }, now)).toBe('refresh');
	});

	it('serves "unavailable" for its shorter time, then fetches again', () => {
		expect(previewAction({ status: ChatLinkPreviewStatusEnum.UNAVAILABLE, fetchedAt: ago(1000) }, now)).toBe('serve');
		expect(previewAction({ status: ChatLinkPreviewStatusEnum.UNAVAILABLE, fetchedAt: ago(CHAT_LINK_PREVIEW_UNAVAILABLE_TTL_MS + 1) }, now)).toBe('fetch');
	});

	it('waits for a pending fetch, unless it has been pending too long', () => {
		expect(previewAction({ status: ChatLinkPreviewStatusEnum.PENDING, updatedAt: ago(1000) }, now)).toBe('wait');
		expect(previewAction({ status: ChatLinkPreviewStatusEnum.PENDING, updatedAt: ago(CHAT_LINK_PREVIEW_PENDING_TTL_MS + 1) }, now)).toBe('fetch');
		expect(previewAction({ status: ChatLinkPreviewStatusEnum.PENDING }, now)).toBe('fetch');
	});
});
