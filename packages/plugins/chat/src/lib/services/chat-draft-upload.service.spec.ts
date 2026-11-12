/**
 * `ChatDraftUploadService`: what is recorded as a draft upload, and what the sweep and a discard purge.
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application); its `FileStorage` hands
 * out the provider double each test inspects.
 */
const provider = { deleteFile: jest.fn(async () => undefined) };
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	const explicit: Record<string, unknown> = {
		__esModule: true,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		FileStorage: class {
			getProvider() {
				return provider;
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
		keyNamedElsewhere?: number;
		claimed?: number;
		deleteFails?: boolean;
		databaseType?: string;
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
			count: jest.fn(async () => options.keyNamedElsewhere ?? 0)
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
	return { service: new ChatDraftUploadService(dataSource), repositories, inserted, subscribers, messageQuery, insertQuery, calls, dataSource };
}

describe('ChatDraftUploadService', () => {
	beforeEach(() => provider.deleteFile.mockClear());

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

	it('keeps the stored bytes another document row still names (a version, a trashed twin)', async () => {
		const { service, repositories } = over({ keyNamedElsewhere: 1 });
		await expect(service.discard(caller, 'd1')).resolves.toEqual({ discarded: true });
		expect(repositories['Document']['delete']).toHaveBeenCalled();
		expect(provider.deleteFile).not.toHaveBeenCalled();
	});

	it('keeps a document a message carries, a link names, a share gives out, or its owner adopted in Docs', async () => {
		for (const options of [
			{ links: 1 },
			{ shares: 1 },
			{ named: 1 },
			{ document: draftDocument({ parentId: 'folder' }) },
			{ document: draftDocument({ visibility: DocumentVisibilityEnum.ORGANIZATION }) }
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
