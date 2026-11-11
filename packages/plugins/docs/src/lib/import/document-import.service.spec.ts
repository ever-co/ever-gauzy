/**
 * The request side of the import (`docs-import-export` spec FR-1, FR-2, FR-5, FR-12, FR-18): the flag, the archive
 * pre-check (a refused zip is deleted and answered with its code), the target resolution, the options stored for the
 * queue thread, the job, the read scope and the stale-import resume.
 *
 * `@gauzy/core` boots the application graph on import, so the pieces the service uses are stubbed; so are the entity
 * and the services around it (their ORM graph does not load under jest).
 */
const storage = { files: new Map<string, Buffer>(), deleted: [] as string[] };
const context = { tenantId: 'tenant-1', userId: 'user-1', manage: false };

jest.mock('@gauzy/core', () => ({
	FileStorage: class {
		getProvider() {
			return {
				name: 'local',
				getFile: async (key: string) => storage.files.get(key),
				deleteFile: async (key: string) => {
					storage.deleted.push(key);
				}
			};
		}
	},
	readStorageFileAsBuffer: async (provider: { getFile(key: string): Promise<Buffer> }, key: string) => provider.getFile(key),
	RequestContext: {
		currentTenantId: () => context.tenantId,
		currentUserId: () => context.userId,
		hasPermission: () => context.manage
	},
	TenantOrganizationBaseDTO: class {}
}));
jest.mock('../entities/document-import.entity', () => ({ DocumentImport: class {} }));
jest.mock('../repositories/type-orm-document-import.repository', () => ({ TypeOrmDocumentImportRepository: class {} }));
jest.mock('../services/document.service', () => ({ DocumentService: class {} }));
jest.mock('../services/document-settings.service', () => ({ DocumentSettingsService: class {} }));
jest.mock('../services/document-quota.service', () => ({ DocumentQuotaService: class {} }));
jest.mock('../knowledge/queue/docs-queue.service', () => ({ DocsQueueService: class {} }));

import { HttpException, NotFoundException } from '@nestjs/common';
import { DocumentImportLayoutEnum, DocumentImportStatusEnum, DocumentKindEnum, DocumentVisibilityEnum } from '@gauzy/contracts';
import { DOCS_IMPORT_DISABLED, DOCS_IMPORT_FILE_REQUIRED, DOCS_IMPORT_NO_PAGES, DOCS_IMPORT_UNSAFE_PATH, ENV_GAUZY_DOCS_IMPORT_ENABLED } from '../docs.constants';
import { DOCS_JOB_IMPORT } from '../knowledge/queue/constants';
import { createImportZip } from './__fixtures__/import-zip.fixture';
import { DocumentImportService } from './document-import.service';
import { importStaleAction } from './document-import.view';

const ORG = 'org-1';

function build() {
	const rows: any[] = [];
	const imports: any = {
		create: (value: any) => ({ ...value }),
		save: jest.fn(async (value: any) => {
			const row = { id: `import-${rows.length + 1}`, createdByUserId: context.userId, createdAt: new Date(), ...value };
			rows.push(row);
			return row;
		}),
		find: jest.fn(async () => rows),
		findOne: jest.fn(async ({ where }: any) => rows.find((row) => row.id === where.id && row.tenantId === where.tenantId) ?? null),
		update: jest.fn(async (where: any, patch: any) => Object.assign(rows.find((row) => row.id === where.id) ?? {}, patch))
	};
	const parent = { id: 'parent-1', kind: DocumentKindEnum.PAGE, visibility: DocumentVisibilityEnum.TEAM, organizationTeamId: 'team-1' };
	const documents: any = {
		resolveOrganizationId: () => ORG,
		findOneScoped: jest.fn(async (id: string) => {
			if (id === parent.id) return parent;
			if (id === 'file-1') return { id, kind: DocumentKindEnum.FILE };
			throw new NotFoundException();
		}),
		assertCanWrite: jest.fn(async () => undefined),
		resolveSpaceFields: jest.fn(async (visibility: DocumentVisibilityEnum, organizationTeamId: string | null) => ({ visibility, organizationTeamId: visibility === DocumentVisibilityEnum.TEAM ? organizationTeamId : null }))
	};
	const settings: any = { getDefaults: jest.fn(async () => ({ importToKnowledgeDefault: true, defaultVisibility: DocumentVisibilityEnum.PRIVATE })) };
	const quota: any = { getQuotaBytes: jest.fn(async () => 123456) };
	const queue: any = { enqueue: jest.fn(async () => true), jobIdFor: (job: string, id: string) => `docs:${job.slice(5)}:${id}` };
	const service = new DocumentImportService(imports, documents, settings, quota, queue);
	return { service, rows, imports, documents, settings, queue };
}

function upload(name: string, zip: Buffer) {
	const key = `documents/tenant-1/org-1/imports/${name}.zip`;
	storage.files.set(key, zip);
	return { key, size: zip.length, originalname: `../${name}.zip`, fieldname: 'file', filename: `${name}.zip`, url: '', path: '' };
}

const VAULT = createImportZip([
	{ name: 'Vault/Home.md', data: '# Home' },
	{ name: 'Vault/Notes/Idea.md', data: 'idea' }
]);

describe('DocumentImportService', () => {
	const saved = process.env[ENV_GAUZY_DOCS_IMPORT_ENABLED];
	beforeEach(() => {
		process.env[ENV_GAUZY_DOCS_IMPORT_ENABLED] = 'true';
		storage.deleted = [];
		context.manage = false;
		context.userId = 'user-1';
	});
	afterAll(() => {
		if (saved === undefined) delete process.env[ENV_GAUZY_DOCS_IMPORT_ENABLED];
		else process.env[ENV_GAUZY_DOCS_IMPORT_ENABLED] = saved;
	});

	it('answers 404 DOCS_IMPORT_DISABLED while the flag is off', async () => {
		process.env[ENV_GAUZY_DOCS_IMPORT_ENABLED] = 'false';
		const { service } = build();
		await expect(service.list()).rejects.toMatchObject({ response: { code: DOCS_IMPORT_DISABLED } });
		await expect(service.start(undefined, {})).rejects.toBeInstanceOf(NotFoundException);
	});

	it('refuses a request without a zip', async () => {
		const { service } = build();
		await expect(service.start(undefined, {})).rejects.toMatchObject({ response: { code: DOCS_IMPORT_FILE_REQUIRED } });
	});

	it('starts an import into a space: the target, the options for the queue thread, the job', async () => {
		const { service, rows, queue } = build();
		const file = upload('vault', VAULT);
		const view = await service.start(file, { visibility: DocumentVisibilityEnum.TEAM, organizationTeamId: 'team-9' });

		expect(view).toMatchObject({ status: DocumentImportStatusEnum.QUEUED, layout: DocumentImportLayoutEnum.MARKDOWN_VAULT, fileName: 'vault.zip', parentId: null, visibility: DocumentVisibilityEnum.TEAM, organizationTeamId: 'team-9' });
		expect(view).not.toHaveProperty('storageKey');
		expect(view).not.toHaveProperty('optionsJson');
		// Vault, Notes, Home, Idea — plus the two pages once more for their content.
		expect(view.totalItems).toBe(6);
		expect(JSON.parse(rows[0].optionsJson)).toMatchObject({ quotaBytes: 123456, importToKnowledge: true, initiatedByUserId: 'user-1' });
		expect(rows[0]).toMatchObject({ storageKey: file.key, tenantId: 'tenant-1', organizationId: ORG });
		expect(queue.enqueue).toHaveBeenCalledWith(DOCS_JOB_IMPORT, expect.objectContaining({ documentId: rows[0].id, tenantId: 'tenant-1', organizationId: ORG, reason: 'import' }), {});
		expect(storage.deleted).toEqual([]);
	});

	it("starts an import under a parent: the parent's space, after the write check", async () => {
		const { service, rows, documents } = build();
		await service.start(upload('vault2', VAULT), { parentId: 'parent-1', visibility: DocumentVisibilityEnum.PRIVATE });
		expect(documents.assertCanWrite).toHaveBeenCalled();
		expect(rows[0]).toMatchObject({ parentId: 'parent-1', visibility: DocumentVisibilityEnum.TEAM, organizationTeamId: 'team-1' });
	});

	it('takes the organization default space when none is named', async () => {
		const { service, rows } = build();
		await service.start(upload('vault3', VAULT), {});
		expect(rows[0].visibility).toBe(DocumentVisibilityEnum.PRIVATE);
	});

	it('refuses a file parent, and deletes the zip', async () => {
		const { service } = build();
		const file = upload('vault4', VAULT);
		await expect(service.start(file, { parentId: 'file-1' })).rejects.toMatchObject({ status: 400 });
		expect(storage.deleted).toEqual([file.key]);
	});

	it('refuses an unsafe archive with its code and status, and deletes it', async () => {
		const { service, rows } = build();
		const file = upload('evil', createImportZip([{ name: '../escape.md', data: 'x' }]));
		const error = await service.start(file, {}).catch((caught) => caught);
		expect(error).toBeInstanceOf(HttpException);
		expect(error.getStatus()).toBe(400);
		expect(error.getResponse()).toMatchObject({ code: DOCS_IMPORT_UNSAFE_PATH });
		expect(storage.deleted).toEqual([file.key]);
		expect(rows).toHaveLength(0);
	});

	it('refuses an archive without a page file', async () => {
		const { service } = build();
		const error = await service.start(upload('images', createImportZip([{ name: 'a.png', data: 'x' }])), {}).catch((caught) => caught);
		expect(error.getResponse()).toMatchObject({ code: DOCS_IMPORT_NO_PAGES });
	});

	it("reads one's own import, and answers 404 for another member's unless they manage Docs", async () => {
		const { service } = build();
		const view = await service.start(upload('vault5', VAULT), {});
		await expect(service.get(view.id as string)).resolves.toMatchObject({ id: view.id, report: null });
		context.userId = 'user-2';
		await expect(service.get(view.id as string)).rejects.toBeInstanceOf(NotFoundException);
		context.manage = true;
		await expect(service.get(view.id as string)).resolves.toMatchObject({ id: view.id });
	});

	it('resumes a stalled import when it is read, with a run-unique job id', async () => {
		const { service, rows, queue } = build();
		const view = await service.start(upload('vault6', VAULT), {});
		rows[0].status = DocumentImportStatusEnum.RUNNING;
		rows[0].lastProgressAt = new Date(Date.now() - 60 * 60_000);
		rows[0].attempts = 1;
		queue.enqueue.mockClear();
		const read = await service.get(view.id as string);
		expect(read.status).toBe(DocumentImportStatusEnum.QUEUED);
		expect(queue.enqueue).toHaveBeenCalledWith(DOCS_JOB_IMPORT, expect.anything(), { jobId: expect.stringMatching(/^docs:import:import-1:resume-\d+$/) });
	});

	it('gives up a stalled import that has had its runs', async () => {
		const { service, rows } = build();
		const view = await service.start(upload('vault7', VAULT), {});
		Object.assign(rows[0], { status: DocumentImportStatusEnum.RUNNING, lastProgressAt: new Date(0), attempts: 3 });
		const read = await service.get(view.id as string);
		expect(read).toMatchObject({ status: DocumentImportStatusEnum.FAILED, errorCode: 'DOCS_IMPORT_STALLED' });
	});

	it('sweeps stalled imports at startup', async () => {
		const { service, rows, queue } = build();
		await service.start(upload('vault8', VAULT), {});
		Object.assign(rows[0], { status: DocumentImportStatusEnum.QUEUED, lastProgressAt: new Date(0), attempts: 0 });
		queue.enqueue.mockClear();
		await expect(service.resumeStale()).resolves.toBe(1);
		expect(queue.enqueue).toHaveBeenCalledTimes(1);
	});
});

describe('importStaleAction', () => {
	const now = new Date('2026-11-11T12:00:00Z');
	const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

	it('leaves finished and recent imports alone', () => {
		expect(importStaleAction({ status: DocumentImportStatusEnum.COMPLETED, lastProgressAt: ago(600) }, now)).toBe('none');
		expect(importStaleAction({ status: DocumentImportStatusEnum.RUNNING, lastProgressAt: ago(2) }, now)).toBe('none');
	});

	it('resumes a stalled import, and fails one that had its runs', () => {
		expect(importStaleAction({ status: DocumentImportStatusEnum.RUNNING, lastProgressAt: ago(11), attempts: 2 }, now)).toBe('resume');
		expect(importStaleAction({ status: DocumentImportStatusEnum.QUEUED, createdAt: ago(30) }, now)).toBe('resume');
		expect(importStaleAction({ status: DocumentImportStatusEnum.RUNNING, lastProgressAt: ago(11), attempts: 3 }, now)).toBe('fail');
	});
});
