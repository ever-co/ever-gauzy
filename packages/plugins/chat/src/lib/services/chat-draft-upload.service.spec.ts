/**
 * `ChatDraftUploadService`: what is recorded as a draft upload, and what the sweep and a discard purge.
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application); its `FileStorage` hands
 * out the provider double each test inspects.
 */
/** Whether the code runs inside `runWithTenantStorageSettings`, and with which settings. */
const storage = { inside: false, settings: [] as unknown[], made: [] as Array<{ provider: unknown; inside: boolean }> };
const provider = { deleteFile: jest.fn(async (_key: string) => ({ inside: storage.inside })) };
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	const explicit: Record<string, unknown> = {
		__esModule: true,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		// Records where each provider is made: a provider reads the tenant's settings when it is made.
		FileStorage: class {
			getProvider(name?: unknown) {
				storage.made.push({ provider: name, inside: storage.inside });
				return provider;
			}
		},
		runWithTenantStorageSettings: async (settings: unknown, work: () => Promise<unknown>) => {
			storage.settings.push(settings);
			storage.inside = true;
			try {
				return await work();
			} finally {
				storage.inside = false;
			}
		}
	};
	// Any other export: a stand-in nothing here calls.
	const anything = function Anything() {
		return undefined;
	};
	return new Proxy(explicit, { get: (target, name) => (name in target ? target[name as string] : anything) });
});

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DocumentKindEnum, DocumentSourceEnum, DocumentVisibilityEnum } from '@gauzy/contracts';
import { ChatDraftUploadService } from './chat-draft-upload.service';
import { IChatCaller } from './chat-access.service';

const caller: IChatCaller = { tenantId: 'ten', organizationId: 'org', userId: 'u1', employeeId: 'e1', canManage: false };

function draftDocument(overrides: Record<string, unknown> = {}) {
	return {
		id: 'd1',
		tenantId: 'ten',
		kind: DocumentKindEnum.FILE,
		source: DocumentSourceEnum.CHAT,
		visibility: DocumentVisibilityEnum.PRIVATE,
		parentId: null,
		createdByUserId: 'u1',
		storageProvider: 'LOCAL',
		storageKey: 'docs/d1.png',
		thumbKey: 'docs/d1.thumb.webp',
		...overrides
	};
}

/** An insert query double: hands the values to `record`, then answers `execute` (or fails with `failure`). */
function queryRecording(record: (values: unknown) => void, failure?: Error) {
	const query = {
		insert: () => query,
		into: () => query,
		values: (values: unknown) => {
			record(values);
			return query;
		},
		orIgnore: () => query,
		execute: () => (failure ? Promise.reject(failure) : Promise.resolve({}))
	};
	return query;
}

/** The service over repository doubles: one draft row, its document, and what else names the document or its keys. */
function over(
	options: {
		document?: Record<string, unknown> | null;
		links?: number;
		shares?: number;
		named?: number;
		/** Other document rows (any tenant, trashed included) and the keys they name. */
		otherRows?: Array<{ storageKey?: string; thumbKey?: string }>;
		claimed?: number;
		deleteFails?: boolean;
		databaseType?: string;
		/** What the tenant's settings read answers (a rejection: they cannot be read). */
		tenantSettings?: () => Promise<Record<string, unknown>>;
	} = {}
) {
	const draft = { id: 'dr1', tenantId: 'ten', documentId: 'd1', userId: 'u1', createdAt: new Date('2026-11-01T00:00:00Z') };
	const inserted: unknown[] = [];
	const calls: string[] = [];
	const repositories: Record<string, Record<string, jest.Mock>> = {
		ChatAttachmentDraft: {
			findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => (where['userId'] === draft.userId && where['documentId'] === draft.documentId ? draft : null)),
			find: jest.fn(async () => [draft]),
			delete: jest.fn(async () => {
				calls.push('claim');
				return { affected: options.claimed ?? 1 };
			})
		},
		Document: {
			findOne: jest.fn(async () => {
				calls.push('document');
				return options.document === undefined ? draftDocument() : options.document;
			}),
			delete: jest.fn(async () => {
				if (options.deleteFails) throw new Error('connection lost');
				return { affected: 1 };
			}),
			// How many other rows name the key asked for, as the query's clauses (`storageKey` or `thumbKey`) say.
			count: jest.fn(async ({ where }: { where: Array<{ storageKey?: string; thumbKey?: string }> }) =>
				(options.otherRows ?? []).filter((row) => where.some((clause) => (clause.storageKey !== undefined && row.storageKey === clause.storageKey) || (clause.thumbKey !== undefined && row.thumbKey === clause.thumbKey))).length
			)
		},
		DocumentLink: { count: jest.fn(async () => options.links ?? 0) },
		DocumentShare: { count: jest.fn(async () => options.shares ?? 0) }
	};
	const messageQuery = {
		withDeleted: () => messageQuery,
		where: () => messageQuery,
		andWhere: () => messageQuery,
		getCount: jest.fn(async () => options.named ?? 0)
	};
	repositories['ChatMessage'] = { createQueryBuilder: jest.fn(() => messageQuery) };
	const insertQuery = {
		insert: () => insertQuery,
		into: () => insertQuery,
		values: (values: unknown) => (inserted.push(values), insertQuery),
		orIgnore: () => insertQuery,
		execute: jest.fn(async () => ({}))
	};
	const subscribers: unknown[] = [];
	const getRepository = (entity: string | { name?: string }) => repositories[typeof entity === 'string' ? entity : String(entity?.name)];
	const manager = { getRepository, createQueryBuilder: () => insertQuery };
	const dataSource = {
		options: { type: options.databaseType ?? 'postgres' },
		subscribers,
		manager,
		getRepository,
		createQueryBuilder: () => insertQuery,
		transaction: jest.fn(async (work: (m: typeof manager) => Promise<unknown>) => work(manager))
	} as unknown as DataSource;
	const tenantSettings = { getSettings: jest.fn(options.tenantSettings ?? (async () => ({ fileStorageProvider: 'S3', aws_bucket: 'tenant-bucket' }))) };
	return {
		service: new ChatDraftUploadService(dataSource, tenantSettings as never),
		repositories,
		inserted,
		subscribers,
		messageQuery,
		insertQuery,
		calls,
		dataSource,
		tenantSettings
	};
}

describe('ChatDraftUploadService', () => {
	beforeEach(() => {
		provider.deleteFile.mockClear();
		storage.settings = [];
		storage.made = [];
	});

	it("records a chat composer upload in the document's own transaction, and nothing else", async () => {
		const { service, inserted, subscribers } = over();
		service.onModuleInit();
		service.onModuleDestroy();
		expect(subscribers).toEqual([]);
		service.onModuleInit();
		const listener = subscribers[0] as { afterInsert: (event: unknown) => Promise<void> | void };
		const upload = { createQueryBuilder: () => queryRecording((values) => inserted.push({ through: 'upload', ...(values as object) })) };
		expect(listener.afterInsert({ metadata: { tableName: 'task' }, entity: { id: 't1' }, manager: upload })).toBeUndefined();
		expect(listener.afterInsert({ metadata: { tableName: 'document' }, entity: { ...draftDocument(), metadata: { chat: {} } }, manager: upload })).toBeUndefined();
		// The insert awaits what the listener returns: the draft row is written before the upload commits.
		const recorded = listener.afterInsert({
			metadata: { tableName: 'document' },
			entity: { ...draftDocument(), organizationId: 'org', metadata: { upload: {} } },
			manager: upload
		});
		expect(recorded).toBeInstanceOf(Promise);
		await recorded;
		expect(inserted).toEqual([{ through: 'upload', documentId: 'd1', userId: 'u1', tenantId: 'ten', organizationId: 'org' }]);
		service.onModuleDestroy();
	});

	it('fails the upload when its draft cannot be recorded (the two commit together or not at all)', async () => {
		const { service } = over();
		const failing = { createQueryBuilder: () => queryRecording(() => undefined, new Error('no table')) };
		await expect(service.record(draftDocument(), failing as never)).rejects.toThrow('no table');
	});

	it('purges an untouched draft nothing carries, and frees its stored file and thumbnail', async () => {
		const { service, repositories } = over();
		await expect(service.discard(caller, 'd1')).resolves.toEqual({ discarded: true });
		expect(repositories['ChatAttachmentDraft']['delete']).toHaveBeenCalledWith({ id: 'dr1', tenantId: 'ten' });
		expect(repositories['Document']['delete']).toHaveBeenCalledWith({ id: 'd1', tenantId: 'ten' });
		expect(provider.deleteFile.mock.calls).toEqual([['docs/d1.png'], ['docs/d1.thumb.webp']]);
	});

	it("frees the stored bytes in the tenant's own storage: the sweep has no request to carry its settings", async () => {
		const { service, tenantSettings } = over({ document: draftDocument({ storageProvider: 'S3' }) });
		await expect(service.sweep(new Date('2026-11-03T00:00:00Z'))).resolves.toEqual({ purged: 1, kept: 0, gone: 0 });
		expect(tenantSettings.getSettings).toHaveBeenCalledWith({ where: { tenantId: 'ten' } });
		// A tenant with its own bucket kept the bytes: they were deleted from the deployment's bucket instead.
		expect(storage.settings).toEqual([
			{ fileStorageProvider: 'S3', aws_bucket: 'tenant-bucket' },
			{ fileStorageProvider: 'S3', aws_bucket: 'tenant-bucket' }
		]);
		// The provider is made inside the settings too (made outside, it would have read the deployment's).
		expect(storage.made).toEqual([
			{ provider: 'S3', inside: true },
			{ provider: 'S3', inside: true }
		]);
		await expect(Promise.all(provider.deleteFile.mock.results.map((result) => result.value))).resolves.toEqual([{ inside: true }, { inside: true }]);
	});

	it('still purges the draft when freeing its bytes fails, and says so', async () => {
		const { service } = over();
		provider.deleteFile.mockRejectedValueOnce(new Error('bucket unreachable'));
		const warn = jest.spyOn((service as unknown as { logger: { warn: (message: string) => void } }).logger, 'warn').mockImplementation(() => undefined);
		await expect(service.sweep(new Date('2026-11-03T00:00:00Z'))).resolves.toEqual({ purged: 1, kept: 0, gone: 0 });
		// The other key is still freed.
		expect(provider.deleteFile.mock.calls).toEqual([['docs/d1.png'], ['docs/d1.thumb.webp']]);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('bucket unreachable'));
	});

	it("deletes nothing from the deployment's storage when the tenant's settings cannot be read (the row still goes)", async () => {
		const { service, repositories } = over({
			tenantSettings: async () => {
				throw new Error('database went away');
			}
		});
		const warn = jest.spyOn((service as unknown as { logger: { warn: (message: string) => void } }).logger, 'warn').mockImplementation(() => undefined);
		await expect(service.sweep(new Date('2026-11-03T00:00:00Z'))).resolves.toEqual({ purged: 1, kept: 0, gone: 0 });
		expect(repositories['Document']['delete']).toHaveBeenCalledWith({ id: 'd1', tenantId: 'ten' });
		expect(provider.deleteFile).not.toHaveBeenCalled();
		expect(storage.made).toEqual([]);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('could not be read'));
	});

	it('keeps the stored bytes another document row still names (a version, a trashed twin), and only those', async () => {
		// Another row names the file's key (as its thumbnail, even): the file stays, the thumbnail goes.
		const { service, repositories } = over({ otherRows: [{ thumbKey: 'docs/d1.png' }, { storageKey: 'docs/other.png', thumbKey: 'docs/other.thumb.webp' }] });
		await expect(service.discard(caller, 'd1')).resolves.toEqual({ discarded: true });
		expect(repositories['Document']['delete']).toHaveBeenCalled();
		expect(provider.deleteFile.mock.calls).toEqual([['docs/d1.thumb.webp']]);
	});

	it('frees both keys when the other rows name only other keys', async () => {
		const { service } = over({ otherRows: [{ storageKey: 'docs/d1.png.bak' }, { thumbKey: 'docs/d1.thumb.png' }] });
		await expect(service.discard(caller, 'd1')).resolves.toEqual({ discarded: true });
		expect(provider.deleteFile.mock.calls).toEqual([['docs/d1.png'], ['docs/d1.thumb.webp']]);
	});

	it('keeps a document a message carries, a link names, a share gives out, or its owner adopted, archived or trashed in Docs', async () => {
		for (const options of [
			{ links: 1 },
			{ shares: 1 },
			{ named: 1 },
			{ document: draftDocument({ parentId: 'folder' }) },
			{ document: draftDocument({ visibility: DocumentVisibilityEnum.ORGANIZATION }) },
			{ document: draftDocument({ isArchived: true }) },
			{ document: draftDocument({ deletedAt: new Date('2026-11-02T00:00:00Z') }) }
		]) {
			const { service, repositories } = over(options);
			await expect(service.discard(caller, 'd1')).resolves.toEqual({ discarded: false });
			expect(repositories['Document']['delete']).not.toHaveBeenCalled();
		}
		expect(provider.deleteFile).not.toHaveBeenCalled();
	});

	it("answers not found for a file that is not one of the caller's drafts", async () => {
		const { service, repositories } = over();
		await expect(service.discard({ ...caller, userId: 'u2' }, 'd1')).rejects.toBeInstanceOf(NotFoundException);
		expect(repositories['ChatAttachmentDraft']['delete']).not.toHaveBeenCalled();
	});

	it('sweeps a draft once: a replica that claimed it first leaves this one nothing to do', async () => {
		const first = over();
		await expect(first.service.sweep(new Date('2026-11-03T00:00:00Z'))).resolves.toEqual({ purged: 1, kept: 0, gone: 0 });
		const second = over({ claimed: 0 });
		await expect(second.service.sweep(new Date('2026-11-03T00:00:00Z'))).resolves.toEqual({ purged: 0, kept: 0, gone: 1 });
		expect(second.repositories['Document']['delete']).not.toHaveBeenCalled();
	});

	it("locks the document's row before it claims the draft, all in one transaction (the order a send takes them in)", async () => {
		const { service, repositories, calls, dataSource } = over();
		await service.discard(caller, 'd1');
		expect((dataSource.transaction as jest.Mock).mock.calls).toHaveLength(1);
		expect(calls).toEqual(['document', 'claim']);
		expect(repositories['Document']['findOne'].mock.calls[0][0]).toEqual(expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
		const sqlite = over({ databaseType: 'sqlite' });
		await sqlite.service.discard(caller, 'd1');
		expect(sqlite.repositories['Document']['findOne'].mock.calls[0][0]).not.toHaveProperty('lock');
	});

	it('leaves a draft whose purge failed for the next pass, and frees no bytes', async () => {
		const { service, dataSource } = over({ deleteFails: true });
		await expect(service.sweep(new Date('2026-11-03T00:00:00Z'))).resolves.toEqual({ purged: 0, kept: 0, gone: 0 });
		// The claim was made in the transaction that failed: it rolls back with it, so the draft row stays.
		await expect((dataSource.transaction as jest.Mock).mock.results[0].value).rejects.toThrow('connection lost');
		expect(provider.deleteFile).not.toHaveBeenCalled();
	});

	it('drops a draft whose document is gone (never committed, or purged since)', async () => {
		const { service, repositories } = over({ document: null });
		await expect(service.sweep(new Date('2026-11-03T00:00:00Z'))).resolves.toEqual({ purged: 0, kept: 0, gone: 1 });
		expect(repositories['Document']['delete']).not.toHaveBeenCalled();
	});

	it('consumes the drafts of the files a message attaches, in its transaction, holding the files until it commits', async () => {
		const { service } = over();
		const remove = jest.fn(async () => ({ affected: 1 }));
		const find = jest.fn(async () => [{ id: 'd1' }, { id: 'd2' }]);
		const manager = { getRepository: (entity: unknown) => (entity === 'Document' ? { find } : { delete: remove }) };
		await service.consume(manager as never, 'ten', []);
		expect(find).not.toHaveBeenCalled();
		expect(remove).not.toHaveBeenCalled();
		await service.consume(manager as never, 'ten', ['d2', 'd1', 'd2']);
		expect(find).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: expect.objectContaining({ _value: ['d1', 'd2'] }), tenantId: 'ten' }, lock: { mode: 'pessimistic_read' } })
		);
		expect(remove).toHaveBeenCalledWith({ tenantId: 'ten', documentId: expect.objectContaining({ _value: ['d1', 'd2'] }) });
	});

	it('refuses a message whose file a discard or the sweep removed first', async () => {
		const { service } = over();
		const remove = jest.fn(async () => ({ affected: 1 }));
		const manager = { getRepository: (entity: unknown) => (entity === 'Document' ? { find: async () => [{ id: 'd1' }] } : { delete: remove }) };
		await expect(service.consume(manager as never, 'ten', ['d1', 'd2'])).rejects.toBeInstanceOf(BadRequestException);
		expect(remove).not.toHaveBeenCalled();
	});
});
