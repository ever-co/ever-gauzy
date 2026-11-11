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
	return new Proxy(explicit, { get: (target, name) => (name in target ? target[name as string] : function Anything() {}) });
});

import { NotFoundException } from '@nestjs/common';
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

/** The service over repository doubles: one draft row, its document, and what else names the document or its keys. */
function over(options: { document?: Record<string, unknown> | null; links?: number; named?: number; keyNamedElsewhere?: number; claimed?: number } = {}) {
	const draft = { id: 'dr1', tenantId: 'ten', documentId: 'd1', userId: 'u1', createdAt: new Date('2026-11-01T00:00:00Z') };
	const inserted: unknown[] = [];
	const repositories: Record<string, Record<string, jest.Mock>> = {
		ChatAttachmentDraft: {
			findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => (where['userId'] === draft.userId && where['documentId'] === draft.documentId ? draft : null)),
			find: jest.fn(async () => [draft]),
			delete: jest.fn(async () => ({ affected: options.claimed ?? 1 }))
		},
		Document: {
			findOne: jest.fn(async () => (options.document === undefined ? draftDocument() : options.document)),
			delete: jest.fn(async () => ({ affected: 1 })),
			count: jest.fn(async () => options.keyNamedElsewhere ?? 0)
		},
		DocumentLink: { count: jest.fn(async () => options.links ?? 0) }
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
	const dataSource = {
		options: { type: 'postgres' },
		subscribers,
		getRepository: (entity: string | { name?: string }) => repositories[typeof entity === 'string' ? entity : String(entity?.name)],
		createQueryBuilder: () => insertQuery
	} as unknown as DataSource;
	return { service: new ChatDraftUploadService(dataSource), repositories, inserted, subscribers, messageQuery };
}

describe('ChatDraftUploadService', () => {
	beforeEach(() => provider.deleteFile.mockClear());

	it('records a chat composer upload the moment the document row is inserted, and nothing else', async () => {
		const { service, inserted, subscribers } = over();
		service.onModuleInit();
		service.onModuleDestroy();
		expect(subscribers).toEqual([]);
		service.onModuleInit();
		const listener = subscribers[0] as { afterInsert: (event: unknown) => void };
		listener.afterInsert({ metadata: { tableName: 'task' }, entity: { id: 't1' } });
		listener.afterInsert({ metadata: { tableName: 'document' }, entity: { ...draftDocument(), metadata: { chat: {} } } });
		listener.afterInsert({ metadata: { tableName: 'document' }, entity: { ...draftDocument(), organizationId: 'org', metadata: { upload: {} } } });
		await new Promise((resolve) => setImmediate(resolve));
		expect(inserted).toEqual([{ documentId: 'd1', userId: 'u1', tenantId: 'ten', organizationId: 'org' }]);
		service.onModuleDestroy();
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

	it('keeps a document a message carries, a link names, or its owner adopted in Docs', async () => {
		for (const options of [{ links: 1 }, { named: 1 }, { document: draftDocument({ parentId: 'folder' }) }, { document: draftDocument({ visibility: DocumentVisibilityEnum.ORGANIZATION }) }]) {
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

	it('drops a draft whose document is gone (never committed, or purged since)', async () => {
		const { service, repositories } = over({ document: null });
		await expect(service.sweep(new Date('2026-11-03T00:00:00Z'))).resolves.toEqual({ purged: 0, kept: 0, gone: 1 });
		expect(repositories['Document']['delete']).not.toHaveBeenCalled();
	});

	it('consumes the drafts of the files a message attaches, in its transaction', async () => {
		const { service } = over();
		const remove = jest.fn(async () => ({ affected: 1 }));
		const manager = { getRepository: () => ({ delete: remove }) };
		await service.consume(manager as never, 'ten', []);
		expect(remove).not.toHaveBeenCalled();
		await service.consume(manager as never, 'ten', ['d1', 'd2']);
		expect(remove).toHaveBeenCalledWith({ tenantId: 'ten', documentId: expect.objectContaining({ _value: ['d1', 'd2'] }) });
	});
});
