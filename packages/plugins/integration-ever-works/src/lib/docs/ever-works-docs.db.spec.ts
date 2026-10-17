// cspell:ignore wikilink wikilinks unfiled
/**
 * Docs sync (G-P3-4, plan 05) on a real database (better-sqlite3) against the mock Ever Works Knowledge
 * Base: the synced tree, EW → G documents and folders (content, review state, archive, wikilinks, the
 * conflict version and notice), G → EW pages and folders (create, patch, 412 merge, move, accept, archive,
 * private never), the sweep and the capture's loop guard, and the lease fence on the handler's writes
 * (plan 03 §C.4: a handler that outlived its lease writes nothing once another process holds it).
 */
const mockCaller: { current: { user?: { id?: string; tenantId?: string; lastOrganizationId?: string } } | null } = { current: null };

jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	const entity = (name: string) => ({ [name]: class {} })[name];
	return {
		ColumnIndex: decorator,
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		BaseEntityEventSubscriber: class {},
		createSsrfSafeHttpsAgent: () => undefined,
		...Object.fromEntries(['Tenant', 'Organization', 'Employee', 'EmployeeNotification', 'IntegrationTenant', 'IntegrationSetting', 'UserOrganization'].map((name) => [name, entity(name)])),
		TaskService: class TaskService {},
		OrganizationProjectService: class OrganizationProjectService {},
		EmployeeService: class EmployeeService {},
		// A request context the sync opens (`runWithRequest`): the user it was opened for.
		RequestContext: {
			currentTenantId: () => mockCaller.current?.user?.tenantId ?? null,
			currentUserId: () => mockCaller.current?.user?.id ?? null,
			currentOrganizationId: () => mockCaller.current?.user?.lastOrganizationId ?? null,
			runWithRequest: (req: { user?: { id?: string; tenantId?: string } }, fn: () => unknown) => {
				const previous = mockCaller.current;
				mockCaller.current = req;
				const result = fn();
				if (result && typeof (result as Promise<unknown>).then === 'function')
					return (result as Promise<unknown>).finally(() => {
						mockCaller.current = previous;
					});
				mockCaller.current = previous;
				return result;
			}
		}
	};
});
jest.mock('@gauzy/plugin-docs', () => ({
	Document: class Document {},
	DocumentVersion: class DocumentVersion {},
	DocumentLink: class DocumentLink {}
}));
jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));

import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource, EntitySchema } from 'typeorm';
import { DocumentKindEnum, DocumentReviewReasonEnum, DocumentReviewStatusEnum, DocumentVisibilityEnum } from '@gauzy/contracts';
import { Employee, IntegrationSetting } from '@gauzy/core';
import { Document, DocumentLink, DocumentVersion } from '@gauzy/plugin-docs';
import { EverWorksClient } from '../client/ever-works-client';
import { EverWorksConnection } from '../connection/ever-works-connection.entity';
import { EverWorksEntityLink, EverWorksLinkState, EverWorksLinkType, EverWorksOutboundChange, EverWorksSyncLog } from '../sync/entities/ever-works-sync.entities';
import { EverWorksLeaseFenceSubscriber, EverWorksLeaseLostError, everWorksLease, withLeaseFence } from '../sync/ever-works-lease-fence';
import { EverWorksSyncContext } from '../sync/ever-works-sync.context';
import { EverWorksSyncLogService } from '../sync/ever-works-sync-log.service';
import { EverWorksLinkService } from '../sync/links/ever-works-link.service';
import { MockEverWorksKb } from '../testing/mock-ever-works.kb';
import { MockEverWorksServer } from '../testing/mock-ever-works.server';
import { documentToMarkdown, markdownToDocument } from './ever-works-docs-content';
import { DOCS_TREE, EVER_WORKS_DOCS_SOURCE } from './ever-works-docs.mapper';
import { EverWorksDocsService } from './ever-works-docs.service';
import { EVER_WORKS_DOCUMENT_SIGNALS, EverWorksDocumentSignal, EverWorksDocumentSubscriber } from './ever-works-docs.signals';
import { EverWorksDocsStore } from './ever-works-docs.store';

jest.setTimeout(60_000);

type Row = Record<string, any>;

const base = {
	id: { type: String, primary: true },
	tenantId: { type: String, nullable: true },
	organizationId: { type: String, nullable: true },
	isActive: { type: Boolean, nullable: true, default: true },
	isArchived: { type: Boolean, nullable: true, default: false },
	archivedAt: { type: Date, nullable: true },
	createdAt: { type: Date, createDate: true },
	updatedAt: { type: Date, updateDate: true },
	createdByUserId: { type: String, nullable: true },
	updatedByUserId: { type: String, nullable: true },
	deletedAt: { type: Date, nullable: true, deleteDate: true }
} as const;
const s = (name: string, target: new (...args: never[]) => object, tableName: string, columns: Record<string, unknown>) =>
	new EntitySchema({ name, target, tableName, columns: { ...base, ...columns } as never });
const str = (nullable = true) => ({ type: String, nullable });
const txt = (nullable = true) => ({ type: 'text', nullable });
const json = { type: 'simple-json', nullable: true };
const date = { type: Date, nullable: true };
const int = (nullable = true) => ({ type: Number, nullable });
const bool = { type: Boolean, nullable: true, default: false };

const schemas = [
	// The lease row only (the fence reads it); the rest of the connection is not needed here.
	s('EverWorksConnection', EverWorksConnection, 'ever_works_connection', { leaseOwner: str(), leaseUntil: date }),
	s('Employee', Employee, 'employee', { userId: str() }),
	s('IntegrationSetting', IntegrationSetting, 'integration_setting', { integrationId: str(), settingsName: str(false), settingsValue: str() }),
	s('Document', Document, 'document', {
		kind: str(false), index: { type: Number, default: 0 }, name: str(false), icon: str(), color: str(), description: str(), contentJson: json, contentHtml: txt(),
		contentBinary: { type: 'blob', nullable: true }, isLocked: bool, version: { type: Number, default: 1 }, status: str(), source: str(), knowledgeStatus: str(),
		searchable: { type: Boolean, nullable: true, default: true }, reviewStatus: str(), reviewReason: str(), reviewedAt: date, visibility: str(), externalSource: str(),
		externalId: str(), metadata: json, parentId: str(), extractedTextEdited: bool
	}),
	s('DocumentVersion', DocumentVersion, 'document_version', { documentId: str(false), name: str(false), contentJson: json, contentHtml: txt(), contentBinary: { type: 'blob', nullable: true }, lastSavedAt: date, createdById: str() }),
	s('DocumentLink', DocumentLink, 'document_link', { documentId: str(false), entity: str(false), entityId: str(false), metadata: json }),
	s('EverWorksEntityLink', EverWorksEntityLink, 'ever_works_entity_link', {
		integrationTenantId: str(false), entityType: str(false), gauzyId: str(false), ewId: str(false), ewVersion: int(), ewUpdatedAt: date, gauzyUpdatedAt: date,
		snapshot: txt(), ewOnly: txt(), lastDirection: str(), lastSyncedAt: date, state: str(false), lastError: txt()
	}),
	s('EverWorksOutboundChange', EverWorksOutboundChange, 'ever_works_outbound_change', {
		integrationTenantId: str(false), entityType: str(false), gauzyId: str(false), op: str(false), changedFieldsHint: txt(), actorUserId: str(), status: str(false),
		attempts: int(false), availableAt: date, lastError: txt()
	}),
	s('EverWorksSyncLog', EverWorksSyncLog, 'ever_works_sync_log', {
		integrationTenantId: str(), connectionId: str(), direction: str(false), entityType: str(), gauzyId: str(), ewId: str(), action: str(false), status: str(false),
		message: txt(), details: txt(), resolvedByUserId: str(), resolvedAt: date
	})
];

describe('Ever Works docs sync on SQLite', () => {
	let dir: string;
	let dataSource: DataSource;
	let mock: MockEverWorksServer;
	let kb: MockEverWorksKb;
	let client: EverWorksClient;
	let service: EverWorksDocsService;
	let store: EverWorksDocsStore;
	let links: EverWorksLinkService;
	let context: Row;
	let seq = 0;
	const T = randomUUID();
	const O = randomUUID();
	const M = randomUUID();
	const ewOrg = { id: randomUUID(), slug: 'acme', displayName: 'Acme' };
	const connection = { id: 'c1', connectedByUserId: 'u-admin' };
	const conflicts = { record: jest.fn(async () => undefined) };
	const queue = { enqueue: jest.fn(async () => true) };
	const inbox = { upsertExternal: jest.fn(async () => ({ item: {}, created: true, recipientUserIds: ['u-editor'], skippedUserIds: [] })), create: jest.fn() };

	const documents = () => dataSource.getRepository(Document);
	const page = async (id: unknown) => (await documents().findOne({ where: { id: String(id) } as never, withDeleted: true })) as Row;
	const pageOf = async (ewId: unknown) => {
		const link = await links.byEw(M as never, EverWorksLinkType.DOC, String(ewId));
		return link ? page(link.gauzyId as string) : null;
	};
	const envelope = (type: string, data: Row, aggregateType = 'kb_document') => ({
		id: `evt_${randomUUID()}`,
		seq: String(++seq),
		type,
		version: 1,
		occurredAt: new Date().toISOString(),
		tenantId: mock.tenant.id,
		organizationId: ewOrg.id,
		aggregate: { type: aggregateType, id: data['id'], version: data['version'] },
		actor: { type: 'user', id: 'ew-user-x', label: 'X' },
		data: MockEverWorksKb.dto(data)
	});
	const apply = (type: string, data: Row, aggregateType?: string) =>
		service.apply(envelope(type, data, aggregateType) as never, { connection: connection as never, event: {} as never, organizationId: O as never });
	const push = (gauzyId: string, entityType = EverWorksLinkType.DOC, op: 'upsert' | 'delete' = 'upsert') =>
		service.push({ tenantId: T, organizationId: O, integrationTenantId: M, entityType, gauzyId, op, actorUserId: null } as never, { connection: connection as never, mapping: { id: M } as never });
	const gauzyPage = async (parentId: string, markdown: string, over: Row = {}) => {
		const id = randomUUID();
		const { contentJson, contentHtml } = markdownToDocument(markdown);
		await documents().insert({
			id, tenantId: T, organizationId: O, kind: DocumentKindEnum.PAGE, name: 'Onboarding', parentId, contentJson, contentHtml, version: 1, status: 'READY', source: 'EDITOR',
			knowledgeStatus: 'NONE', reviewStatus: 'NONE', visibility: DocumentVisibilityEnum.ORGANIZATION, createdByUserId: 'u-author', ...over
		} as never);
		return id;
	};
	const gauzyFolder = async (parentId: string, name: string, over: Row = {}) => {
		const id = randomUUID();
		await documents().insert({ id, tenantId: T, organizationId: O, kind: DocumentKindEnum.FOLDER, name, parentId, version: 1, visibility: DocumentVisibilityEnum.ORGANIZATION, ...over } as never);
		return id;
	};

	beforeAll(async () => {
		dir = mkdtempSync(join(tmpdir(), 'ever-works-docs-'));
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: join(dir, 'gauzy.sqlite'),
			entities: schemas,
			// Idle outside a fenced unit: only the lease fence tests below arm it.
			subscribers: [EverWorksLeaseFenceSubscriber],
			synchronize: true
		});
		await dataSource.initialize();
	});

	afterAll(async () => {
		await dataSource?.destroy();
		rmSync(dir, { recursive: true, force: true });
	});

	beforeEach(async () => {
		for (const table of [
			'document',
			'document_version',
			'document_link',
			'ever_works_entity_link',
			'ever_works_outbound_change',
			'ever_works_sync_log',
			'integration_setting',
			'employee',
			'ever_works_connection'
		]) {
			await dataSource.query(`DELETE FROM "${table}"`);
		}
		jest.clearAllMocks();
		mock = new MockEverWorksServer();
		const key = mock.addKey({ organizations: [ewOrg] });
		kb = new MockEverWorksKb(mock);
		client = new EverWorksClient({
			apiBaseUrl: 'https://api.example.test/api',
			apiKey: key,
			transport: mock.transport(),
			connectionId: 'c1',
			scopeSlug: 'acme',
			retry: { maxAttempts: 1 },
			sleep: async () => undefined
		});
		context = {
			tenantId: T,
			organizationId: O,
			integrationTenantId: M,
			mapping: { id: M, settings: [] },
			connection,
			everWorksOrganizationId: ewOrg.id,
			everWorksOrganizationSlug: 'acme',
			directions: { docs: 'both' },
			isEnabled: true
		};
		const contexts = { forEverWorksOrganization: async () => context, forOrganization: async () => context, forConnection: async () => [context] };
		links = new EverWorksLinkService(dataSource);
		store = new EverWorksDocsStore(dataSource);
		const register = { register: () => undefined, registerSweeper: () => undefined };
		service = new EverWorksDocsService(
			dataSource,
			contexts as never,
			{ client: () => client } as never,
			links,
			store,
			new EverWorksSyncLogService(dataSource),
			conflicts as never,
			queue as never,
			register as never,
			register as never,
			register as never,
			inbox as never
		);
	});

	describe('Ever Works → Gauzy', () => {
		it('lands an organization document in Ever Works/Organization/<folders>/ with its content, review state and metadata', async () => {
			const top = kb.addFolder(ewOrg.id, { name: 'Playbooks' });
			const child = kb.addFolder(ewOrg.id, { name: 'Support', parentId: top['id'] });
			const document = kb.addDocument(ewOrg.id, {
				folderId: child['id'],
				title: 'Refund policy',
				body: '# Refunds\n\nWithin **30** days.',
				reviewState: 'proposed',
				source: 'agent',
				class: 'legal',
				tags: ['billing']
			});
			expect(await apply('kb.document.created', document)).toEqual({ status: 'applied' });
			const row = (await pageOf(document['id'])) as Row;
			expect(row).toMatchObject({ kind: 'PAGE', name: 'Refund policy', source: 'INTEGRATION', externalSource: EVER_WORKS_DOCS_SOURCE, externalId: document['id'], visibility: 'ORGANIZATION' });
			expect(row['reviewStatus']).toBe(DocumentReviewStatusEnum.PENDING);
			expect(row['reviewReason']).toBe(DocumentReviewReasonEnum.AI_GENERATED);
			expect(row['metadata']).toMatchObject({ everWorks: { class: 'legal', tags: ['billing'], path: document['path'] } });
			expect(documentToMarkdown(row['contentJson'])).toBe('# Refunds\n\nWithin **30** days.');
			// Ever Works/Organization/Playbooks/Support/Refund policy
			const support = await page(row['parentId']);
			const playbooks = await page(support['parentId']);
			const organization = await page(playbooks['parentId']);
			const root = await page(organization['parentId']);
			expect([support['name'], playbooks['name'], organization['name'], root['name']]).toEqual(['Support', 'Playbooks', 'Organization', 'Ever Works']);
			expect(organization['externalId']).toBe(DOCS_TREE.organization);
			expect(root['parentId']).toBeNull();
			expect(context['mapping'].settings).toEqual([expect.objectContaining({ settingsName: 'DOCS_ROOT_FOLDER_ID', settingsValue: root['id'] })]);
			expect((await links.byEw(M as never, EverWorksLinkType.DOC_FOLDER, child['id'] as string))?.gauzyId).toBe(support['id']);
			// The same event again changes nothing (version check).
			expect(await apply('kb.document.created', document)).toEqual({ status: 'skipped', message: 'already applied (version)' });
		});

		it("lands a Work's document in Works/<Work>/, linked to the Work's paired project", async () => {
			const workId = kb.addWork(ewOrg.id);
			await links.record({ tenantId: T as never, organizationId: O as never, integrationTenantId: M as never, entityType: EverWorksLinkType.PROJECT_WORK, gauzyId: 'project-1' as never, ewId: workId, direction: 'inbound' });
			const document = kb.addDocument(ewOrg.id, { workId, scope: { type: 'work', id: workId }, path: 'freeform/notes.md', title: 'Notes', body: 'Hello' });
			await apply('kb.document.created', document);
			const row = (await pageOf(document['id'])) as Row;
			const workFolder = await page(row['parentId']);
			expect(workFolder['externalId']).toBe(DOCS_TREE.work(workId));
			expect((await page(workFolder['parentId']))['externalId']).toBe(DOCS_TREE.works);
			expect(await dataSource.getRepository(DocumentLink).find()).toEqual([expect.objectContaining({ documentId: workFolder['id'], entity: 'OrganizationProject', entityId: 'project-1' })]);
		});

		it("writes Ever Works' edits, keeps the previous content as a version, and archives on archive or delete", async () => {
			const document = kb.addDocument(ewOrg.id, { body: 'First' });
			await apply('kb.document.created', document);
			Object.assign(document, { title: 'Renamed', body: 'Second', version: 2, revision: 2 });
			await apply('kb.document.updated', document);
			const row = (await pageOf(document['id'])) as Row;
			expect(row['name']).toBe('Renamed');
			expect(documentToMarkdown(row['contentJson'])).toBe('Second');
			const versions = await dataSource.getRepository(DocumentVersion).find();
			expect(versions).toHaveLength(1);
			expect(documentToMarkdown((versions[0] as Row)['contentJson'])).toBe('First');
			Object.assign(document, { status: 'archived', archivedAt: new Date().toISOString(), version: 3 });
			await apply('kb.document.archived', document);
			expect((await page(row['id']))['isArchived']).toBe(true);
			const work = kb.addWork(ewOrg.id);
			const workDocument = kb.addDocument(ewOrg.id, { workId: work, scope: { type: 'work', id: work }, path: 'freeform/a.md', body: 'A' });
			await apply('kb.document.created', workDocument);
			const workPage = (await pageOf(workDocument['id'])) as Row;
			expect(await apply('kb.document.deleted', { ...workDocument, version: 2, deleted: true })).toEqual({ status: 'applied' });
			expect((await page(workPage['id']))['isArchived']).toBe(true);
			expect((await links.byEw(M as never, EverWorksLinkType.DOC, workDocument['id'] as string))?.state).toBe(EverWorksLinkState.UNLINKED);
		});

		it('when both sides changed the body, Ever Works wins and the Gauzy edit is kept as a "Gauzy edit (conflict)" version, logged and noticed', async () => {
			const document = kb.addDocument(ewOrg.id, { title: 'Policy', body: 'Base' });
			await apply('kb.document.created', document);
			const row = (await pageOf(document['id'])) as Row;
			await documents().update({ id: row['id'] } as never, { contentJson: markdownToDocument('Gauzy edit').contentJson, updatedByUserId: 'u-editor' } as never);
			Object.assign(document, { body: 'Ever Works edit', version: 2, revision: 2 });
			const outcome = await apply('kb.document.updated', document);
			expect(outcome).toMatchObject({ status: 'applied', message: expect.stringContaining('Ever Works wins') });
			expect(documentToMarkdown((await page(row['id']))['contentJson'])).toBe('Ever Works edit');
			const versions = (await dataSource.getRepository(DocumentVersion).find()) as Row[];
			expect(versions.map((version) => version['name'])).toEqual(['Policy — Gauzy edit (conflict)']);
			expect(documentToMarkdown(versions[0]['contentJson'])).toBe('Gauzy edit');
			expect(conflicts.record).toHaveBeenCalledWith(expect.objectContaining({ entityType: EverWorksLinkType.DOC, field: 'body', winner: 'ever_works', gauzyId: row['id'] }));
			expect(inbox.upsertExternal).toHaveBeenCalledWith(expect.objectContaining({ entityId: row['id'], recipients: [{ userId: 'u-editor', isRead: false, isArchived: false }] }));
		});

		it('turns a wikilink of a synced document into a document mention', async () => {
			const target = kb.addDocument(ewOrg.id, { path: 'support/escalation.md', title: 'Escalation', body: 'Call us.' });
			await apply('kb.document.created', target);
			const linking = kb.addDocument(ewOrg.id, { path: 'support/refunds.md', body: 'See [[support/escalation.md]].' });
			await apply('kb.document.created', linking);
			const targetPage = (await pageOf(target['id'])) as Row;
			const content = ((await pageOf(linking['id'])) as Row)['contentJson'];
			expect(content.content[0].content[1]).toEqual({ type: 'documentMention', attrs: { id: targetPage['id'], label: 'Escalation', mentionSuggestionChar: '+' } });
			// …and back to the same wikilink.
			const [, toPath] = await (service as unknown as { resolvers: (c: unknown, d: null) => Promise<[unknown, (id: string) => string | null]> }).resolvers(context, null);
			expect(documentToMarkdown(content, { resolveMention: toPath })).toBe('See [[support/escalation.md]].');
		});

		it('stops syncing a page moved out of the synced folders in Gauzy, and the sweep finds it (review #10834)', async () => {
			const document = kb.addDocument(ewOrg.id, { body: 'First' });
			await apply('kb.document.created', document);
			const row = (await pageOf(document['id'])) as Row;
			await documents().update({ id: row['id'] } as never, { parentId: null } as never);
			Object.assign(document, { body: 'Second', version: 2 });
			expect(await apply('kb.document.updated', document)).toMatchObject({ status: 'skipped' });
			expect(documentToMarkdown((await page(row['id']))['contentJson'])).toBe('First');
			expect((await links.byEw(M as never, EverWorksLinkType.DOC, String(document['id'])))?.state).toBe(EverWorksLinkState.UNLINKED);
			// A moved page whose pairing is still live is queued by the sweep (its push then ends the pairing).
			const other = kb.addDocument(ewOrg.id, { path: 'b.md', body: 'B' });
			await apply('kb.document.created', other);
			const otherRow = (await pageOf(other['id'])) as Row;
			await documents().update({ id: otherRow['id'] } as never, { parentId: null } as never);
			await service.sweep(connection as never);
			expect((queue.enqueue.mock.calls as unknown as Array<[Row]>).map(([change]) => change['gauzyId'])).toContain(otherRow['id']);
		});

		it('leaves a folder deleted in Gauzy deleted: no duplicate row, and its documents land in Organization/ (review #10834)', async () => {
			const folder = kb.addFolder(ewOrg.id, { name: 'Guides' });
			await apply('kb.folder.created', folder, 'kb_folder');
			const link = await links.byEw(M as never, EverWorksLinkType.DOC_FOLDER, folder['id'] as string);
			await documents().softDelete({ id: link?.gauzyId } as never);
			Object.assign(folder, { name: 'Handbooks', version: 2 });
			expect(await apply('kb.folder.updated', folder, 'kb_folder')).toEqual({ status: 'applied' });
			const rows = (await documents().find({ where: { externalId: DOCS_TREE.folder(folder['id'] as string) } as never, withDeleted: true })) as Row[];
			expect(rows).toHaveLength(1);
			expect(rows[0]['deletedAt']).toBeTruthy();
			const document = kb.addDocument(ewOrg.id, { folderId: folder['id'], body: 'In the deleted folder' });
			await apply('kb.document.created', document);
			const organization = await store.organizationFolder(context as never);
			expect(((await pageOf(document['id'])) as Row)['parentId']).toBe(organization);
		});

		it("stops applying Ever Works' edits to a page or folder made PRIVATE in Gauzy (review F26, #11018 review)", async () => {
			const folder = kb.addFolder(ewOrg.id, { name: 'Guides' });
			await apply('kb.folder.created', folder, 'kb_folder');
			const folderLink = await links.byEw(M as never, EverWorksLinkType.DOC_FOLDER, folder['id'] as string);
			const document = kb.addDocument(ewOrg.id, { folderId: folder['id'], body: 'First' });
			await apply('kb.document.created', document);
			const row = (await pageOf(document['id'])) as Row;
			expect(row['parentId']).toBe(folderLink?.gauzyId);
			await documents().update({ id: folderLink?.gauzyId } as never, { visibility: DocumentVisibilityEnum.PRIVATE, name: 'Guides (private)' } as never);
			Object.assign(document, { body: 'Second', version: 2, revision: 2 });
			expect(await apply('kb.document.updated', document)).toEqual({ status: 'skipped', message: 'pages in a private folder never sync' });
			expect(documentToMarkdown((await page(row['id']))['contentJson'])).toBe('First');
			Object.assign(folder, { name: 'Handbooks', version: 2 });
			expect(await apply('kb.folder.updated', folder, 'kb_folder')).toEqual({ status: 'skipped', message: 'private folders never sync' });
			expect((await page(folderLink?.gauzyId as string))['name']).toBe('Guides (private)');
			expect((await links.byEw(M as never, EverWorksLinkType.DOC, document['id'] as string))?.state).toBe(EverWorksLinkState.UNLINKED);
			expect((await links.byEw(M as never, EverWorksLinkType.DOC_FOLDER, folder['id'] as string))?.state).toBe(EverWorksLinkState.UNLINKED);
		});

		it('follows a folder rename and archives a deleted folder', async () => {
			const folder = kb.addFolder(ewOrg.id, { name: 'Guides' });
			await apply('kb.folder.created', folder, 'kb_folder');
			const link = await links.byEw(M as never, EverWorksLinkType.DOC_FOLDER, folder['id'] as string);
			Object.assign(folder, { name: 'Handbooks', version: 2 });
			await apply('kb.folder.updated', folder, 'kb_folder');
			expect((await page(link?.gauzyId as string))['name']).toBe('Handbooks');
			await apply('kb.folder.deleted', { ...folder, version: 3, deleted: true }, 'kb_folder');
			expect((await page(link?.gauzyId as string))['isArchived']).toBe(true);
		});
	});

	describe('Gauzy → Ever Works', () => {
		it('creates a page of Organization/ as an organization document, then pushes only what changed', async () => {
			const organization = await store.organizationFolder(context as never);
			const id = await gauzyPage(organization, '# Onboarding\n\nWelcome.');
			expect(await push(id)).toEqual({ status: 'pushed', message: 'created in Ever Works' });
			const [created] = [...kb.documents.values()];
			expect(created).toMatchObject({ scope: { type: 'organization', id: ewOrg.id }, folderId: null, path: 'onboarding.md', title: 'Onboarding', class: 'freeform', body: '# Onboarding\n\nWelcome.', source: 'imported' });
			expect(created['externalLinks']).toEqual([expect.objectContaining({ source: 'gauzy', externalId: id })]);
			expect(await push(id)).toEqual({ status: 'skipped', message: 'nothing changed' });
			await documents().update({ id } as never, { contentJson: markdownToDocument('# Onboarding\n\nWelcome aboard.').contentJson } as never);
			expect(await push(id)).toEqual({ status: 'pushed' });
			expect(created).toMatchObject({ body: '# Onboarding\n\nWelcome aboard.', revision: 2 });
		});

		it('waits for its folder, then files the document in the library folder the Gauzy folder became', async () => {
			const organization = await store.organizationFolder(context as never);
			const folder = await gauzyFolder(organization, 'Playbooks');
			const id = await gauzyPage(folder, 'Text');
			expect(await push(id)).toMatchObject({ status: 'deferred' });
			expect(await push(folder, EverWorksLinkType.DOC_FOLDER)).toEqual({ status: 'pushed', message: 'created in Ever Works' });
			const [ewFolder] = [...kb.folders.values()];
			expect(ewFolder).toMatchObject({ name: 'Playbooks', parentId: null });
			expect(await push(id)).toMatchObject({ status: 'pushed' });
			expect([...kb.documents.values()][0]).toMatchObject({ folderId: ewFolder['id'], path: 'playbooks/onboarding.md' });
		});

		it('on 412 applies Ever Works first, then pushes what only Gauzy changed', async () => {
			const organization = await store.organizationFolder(context as never);
			const id = await gauzyPage(organization, 'Body one');
			await push(id);
			const [ew] = [...kb.documents.values()];
			// Ever Works renames it meanwhile; Gauzy edits the body.
			Object.assign(ew, { title: 'Renamed in Ever Works', version: Number(ew['version']) + 1 });
			await documents().update({ id } as never, { contentJson: markdownToDocument('Body two').contentJson } as never);
			expect(await push(id)).toEqual({ status: 'pushed' });
			expect(ew).toMatchObject({ title: 'Renamed in Ever Works', body: 'Body two' });
			expect((await page(id))['name']).toBe('Renamed in Ever Works');
		});

		it('on 412 when both sides renamed it, Ever Works\' title wins and the conflict is logged (review #10834)', async () => {
			const organization = await store.organizationFolder(context as never);
			const id = await gauzyPage(organization, 'Body');
			await push(id);
			const [ew] = [...kb.documents.values()];
			Object.assign(ew, { title: 'Ever Works title', version: Number(ew['version']) + 1 });
			await documents().update({ id } as never, { name: 'Gauzy title' } as never);
			expect(await push(id)).toEqual({ status: 'skipped', message: 'nothing changed' });
			expect(ew['title']).toBe('Ever Works title');
			expect((await page(id))['name']).toBe('Ever Works title');
			expect(conflicts.record).toHaveBeenCalledWith(expect.objectContaining({ field: 'title', gauzyValue: 'Gauzy title', everWorksValue: 'Ever Works title', winner: 'ever_works' }));
		});

		it('with docs gauzy_to_ew, a 412 never writes Ever Works into Gauzy: the Gauzy edit goes on top of the newer version (review F27)', async () => {
			context['directions'] = { docs: 'gauzy_to_ew' };
			const organization = await store.organizationFolder(context as never);
			const id = await gauzyPage(organization, 'Body one');
			await push(id);
			const [ew] = [...kb.documents.values()];
			// Ever Works edits the body and the title meanwhile (its events are not applied: Gauzy is the source).
			Object.assign(ew, { body: 'Ever Works body', title: 'Ever Works title', version: Number(ew['version']) + 1 });
			await documents().update({ id } as never, { contentJson: markdownToDocument('Gauzy body').contentJson } as never);
			expect(await push(id)).toEqual({ status: 'pushed' });
			expect(ew['body']).toBe('Gauzy body');
			const row = await page(id);
			expect(documentToMarkdown(row['contentJson'])).toBe('Gauzy body');
			expect(row['name']).toBe('Onboarding');
			expect(await dataSource.getRepository(DocumentVersion).count()).toBe(0);
			expect(inbox.upsertExternal).not.toHaveBeenCalled();
		});

		it('with docs gauzy_to_ew, a folder 412 retries the Gauzy rename on the newer version instead of taking Ever Works\' (review F27)', async () => {
			context['directions'] = { docs: 'gauzy_to_ew' };
			const organization = await store.organizationFolder(context as never);
			const folder = await gauzyFolder(organization, 'Guides');
			await push(folder, EverWorksLinkType.DOC_FOLDER);
			const [ewFolder] = [...kb.folders.values()];
			Object.assign(ewFolder, { name: 'Renamed in Ever Works', version: Number(ewFolder['version']) + 1 });
			await documents().update({ id: folder } as never, { name: 'Handbooks' } as never);
			expect(await push(folder, EverWorksLinkType.DOC_FOLDER)).toEqual({ status: 'pushed' });
			expect(ewFolder['name']).toBe('Handbooks');
			expect((await page(folder))['name']).toBe('Handbooks');
			// Ever Works changes it again while the retry runs (#11033 review): deferred, the rename still pending.
			await documents().update({ id: folder } as never, { name: 'Manuals' } as never);
			mock.fail({ method: 'PATCH', path: /^\/kb\/folders\//, status: 412, body: { error: { code: 'version_mismatch', message: 'The record changed.' } }, times: 2 });
			expect(await push(folder, EverWorksLinkType.DOC_FOLDER)).toEqual({
				status: 'deferred',
				message: 'Ever Works changed the folder again; the Gauzy change is retried',
				retryInMs: 60_000
			});
			expect(ewFolder['name']).toBe('Handbooks');
			expect(await push(folder, EverWorksLinkType.DOC_FOLDER)).toEqual({ status: 'pushed' });
			expect(ewFolder['name']).toBe('Manuals');
		});

		it('sends edits and folder writes as the person who made them (review #10834)', async () => {
			await dataSource.getRepository(Employee).insert({ id: 'e-editor', userId: 'u-editor', tenantId: T, organizationId: O } as never);
			await links.record({ tenantId: T as never, organizationId: O as never, integrationTenantId: M as never, entityType: EverWorksLinkType.MEMBER, gauzyId: 'e-editor' as never, ewId: 'ew-editor', direction: 'inbound' });
			const organization = await store.organizationFolder(context as never);
			const folder = await gauzyFolder(organization, 'Guides');
			await service.push({ tenantId: T, organizationId: O, integrationTenantId: M, entityType: EverWorksLinkType.DOC_FOLDER, gauzyId: folder, op: 'upsert', actorUserId: 'u-editor' } as never, { connection: connection as never, mapping: { id: M } as never });
			const id = await gauzyPage(folder, 'One');
			await push(id);
			await documents().update({ id } as never, { contentJson: markdownToDocument('Two').contentJson } as never);
			await service.push({ tenantId: T, organizationId: O, integrationTenantId: M, entityType: EverWorksLinkType.DOC, gauzyId: id, op: 'upsert', actorUserId: 'u-editor' } as never, { connection: connection as never, mapping: { id: M } as never });
			const actAs = (method: string, path: RegExp) => mock.requests.filter((request) => request.method === method && path.test(request.path)).map((request) => request.headers['x-act-as-user'] ?? null);
			expect(actAs('POST', /^\/kb\/folders$/)).toEqual(['ew-editor']);
			expect(actAs('PATCH', /^\/kb\/documents\//)).toEqual(['ew-editor']);
		});

		it("accepts a proposed document approved in Gauzy's review queue, and archives a removed page", async () => {
			const document = kb.addDocument(ewOrg.id, { reviewState: 'proposed', source: 'agent', body: 'Draft' });
			await apply('kb.document.created', document);
			const row = (await pageOf(document['id'])) as Row;
			await documents().update({ id: row['id'] } as never, { reviewStatus: DocumentReviewStatusEnum.APPROVED } as never);
			expect(await push(row['id'])).toEqual({ status: 'pushed' });
			expect(document['reviewState']).toBe('accepted');
			await documents().softDelete({ id: row['id'] } as never);
			expect(await push(row['id'], EverWorksLinkType.DOC, 'delete')).toMatchObject({ status: 'pushed' });
			expect(document['status']).toBe('archived');
		});

		it('never pushes a private page or a page outside the synced folders', async () => {
			const organization = await store.organizationFolder(context as never);
			const privateId = await gauzyPage(organization, 'Secret', { visibility: DocumentVisibilityEnum.PRIVATE });
			expect(await push(privateId)).toEqual({ status: 'skipped', message: 'private pages never sync' });
			const outside = await gauzyPage(null as never, 'Elsewhere');
			expect(await push(outside)).toEqual({ status: 'skipped', message: 'not in the synced folders' });
			expect(kb.documents.size).toBe(0);
		});

		it('never pushes a private folder, nor a page under one: the folder name stays out of Ever Works (review F26)', async () => {
			const organization = await store.organizationFolder(context as never);
			const secret = await gauzyFolder(organization, 'Layoffs 2027', { visibility: DocumentVisibilityEnum.PRIVATE });
			const inner = await gauzyFolder(secret, 'Lists');
			const pageId = await gauzyPage(secret, 'Plan');
			const deeper = await gauzyPage(inner, 'Names');
			expect(await push(secret, EverWorksLinkType.DOC_FOLDER)).toEqual({ status: 'skipped', message: 'private folders never sync' });
			expect(await push(inner, EverWorksLinkType.DOC_FOLDER)).toEqual({ status: 'skipped', message: 'folders in a private folder never sync' });
			expect(await push(pageId)).toEqual({ status: 'skipped', message: 'pages in a private folder never sync' });
			expect(await push(deeper)).toEqual({ status: 'skipped', message: 'pages in a private folder never sync' });
			// A Work's private subfolder: its name would become a path segment.
			const workFolder = await store.workFolder(context as never, kb.addWork(ewOrg.id), 'Site', null);
			const hidden = await gauzyFolder(workFolder, 'Acquisition', { visibility: DocumentVisibilityEnum.PRIVATE });
			expect(await push(await gauzyPage(hidden, 'Terms'))).toEqual({ status: 'skipped', message: 'pages in a private folder never sync' });
			expect(kb.folders.size).toBe(0);
			expect(kb.documents.size).toBe(0);
			expect(mock.requests.filter((request) => request.method !== 'GET').map((request) => `${request.method} ${request.path}`)).toEqual([]);
		});

		it('stops syncing a synced folder and its pages once the folder turns private in Gauzy (review F26)', async () => {
			const organization = await store.organizationFolder(context as never);
			const folder = await gauzyFolder(organization, 'Playbooks');
			expect(await push(folder, EverWorksLinkType.DOC_FOLDER)).toMatchObject({ status: 'pushed' });
			const pageId = await gauzyPage(folder, 'Text');
			expect(await push(pageId)).toMatchObject({ status: 'pushed' });
			await documents().update({ id: folder } as never, { visibility: DocumentVisibilityEnum.PRIVATE, name: 'Playbooks (HR only)' } as never);
			expect(await push(folder, EverWorksLinkType.DOC_FOLDER)).toEqual({ status: 'skipped', message: 'private folders never sync' });
			expect((await links.byGauzy(M as never, EverWorksLinkType.DOC_FOLDER, folder as never))?.state).toBe(EverWorksLinkState.UNLINKED);
			await documents().update({ id: pageId } as never, { contentJson: markdownToDocument('Edited').contentJson } as never);
			expect(await push(pageId)).toEqual({ status: 'skipped', message: 'pages in a private folder never sync' });
			expect((await links.byGauzy(M as never, EverWorksLinkType.DOC, pageId as never))?.state).toBe(EverWorksLinkState.UNLINKED);
			expect([...kb.folders.values()].map((row) => row['name'])).toEqual(['Playbooks']);
			expect([...kb.documents.values()].map((row) => row['body'])).toEqual(['Text']);
		});

		it('never pushes under a synced root that was made PRIVATE (review F26, #11018 review)', async () => {
			const organization = await store.organizationFolder(context as never);
			const root = await store.existingRoot(context as never);
			await documents().update({ id: root } as never, { visibility: DocumentVisibilityEnum.PRIVATE } as never);
			const folder = await gauzyFolder(organization, 'Guides');
			expect(await push(folder, EverWorksLinkType.DOC_FOLDER)).toEqual({ status: 'skipped', message: 'folders in a private folder never sync' });
			expect(await push(await gauzyPage(organization, 'Text'))).toEqual({ status: 'skipped', message: 'pages in a private folder never sync' });
			expect(kb.folders.size + kb.documents.size).toBe(0);
		});
	});

	describe('lease fence (plan 03 §C.4)', () => {
		/** The loop's claim: `owner` holds the connection's lease for five minutes. */
		const holdLease = async (owner: string) => {
			await dataSource.getRepository(EverWorksConnection).delete({ id: 'c1' } as never);
			await dataSource.getRepository(EverWorksConnection).insert({ id: 'c1', leaseOwner: owner, leaseUntil: new Date(Date.now() + 5 * 60_000) } as never);
		};
		/** The applier's unit for one event: the handler fenced on `owner`'s lease. */
		const applyAs = (owner: string, type: string, data: Row) => withLeaseFence(everWorksLease(dataSource, 'c1', owner), () => apply(type, data));

		it('applies a document while this process holds the lease', async () => {
			await holdLease('process-a');
			const document = kb.addDocument(ewOrg.id, { title: 'Refund policy', body: 'Within 30 days.' });
			expect(await applyAs('process-a', 'kb.document.created', document)).toEqual({ status: 'applied' });
			const row = (await pageOf(document['id'])) as Row;
			expect(row['name']).toBe('Refund policy');
			expect(documentToMarkdown(row['contentJson'])).toBe('Within 30 days.');
		});

		it('a handler that outlived its lease writes nothing once another process holds it (the #10848 interleaving)', async () => {
			await holdLease('process-a');
			const document = kb.addDocument(ewOrg.id, { title: 'Refund policy', body: 'First' });
			expect(await applyAs('process-a', 'kb.document.created', document)).toEqual({ status: 'applied' });
			// A's lease runs out while it works on its next event; B claims it and applies the newer version.
			await holdLease('process-b');
			Object.assign(document, { title: 'Renamed by B', body: 'Second', version: 2, revision: 2 });
			expect(await applyAs('process-b', 'kb.document.updated', document)).toEqual({ status: 'applied' });
			const before = (await pageOf(document['id'])) as Row;
			const versions = await dataSource.getRepository(DocumentVersion).count();
			// A's late write — an event its version check lets through (version 3) — is refused, not written over B's.
			Object.assign(document, { title: 'Stale edit from A', body: 'Third', version: 3, revision: 3 });
			await expect(applyAs('process-a', 'kb.document.updated', document)).rejects.toBeInstanceOf(EverWorksLeaseLostError);
			const after = (await pageOf(document['id'])) as Row;
			expect(after['name']).toBe('Renamed by B');
			expect(documentToMarkdown(after['contentJson'])).toBe('Second');
			expect(after['updatedAt']).toEqual(before['updatedAt']);
			expect(await dataSource.getRepository(DocumentVersion).count()).toBe(versions);
			expect((await links.byEw(M as never, EverWorksLinkType.DOC, document['id'] as string))?.ewVersion).toBe(2);
			// The holder applies the same event as before the fence existed.
			expect(await applyAs('process-b', 'kb.document.updated', document)).toEqual({ status: 'applied' });
			expect(((await pageOf(document['id'])) as Row)['name']).toBe('Stale edit from A');
		});

		it('without a lease (an admin action, the initial wiring) the handler is not fenced', async () => {
			await holdLease('process-b');
			const document = kb.addDocument(ewOrg.id, { title: 'Unfenced' });
			expect(await withLeaseFence(null, () => apply('kb.document.created', document))).toEqual({ status: 'applied' });
			expect(((await pageOf(document['id'])) as Row)['name']).toBe('Unfenced');
		});
	});

	describe('sweep and capture', () => {
		it('queues the pages and folders of the synced tree (all on the first sweep, then what changed)', async () => {
			const organization = await store.organizationFolder(context as never);
			const folder = await gauzyFolder(organization, 'Playbooks');
			const id = await gauzyPage(folder, 'Text');
			await service.sweep(connection as never);
			const queued = (queue.enqueue.mock.calls as unknown as Array<[Row]>).map(([change]) => [change['entityType'], change['gauzyId']]);
			expect(queued).toEqual(expect.arrayContaining([[EverWorksLinkType.DOC_FOLDER, folder], [EverWorksLinkType.DOC, id]]));
			// Later sweeps queue what changed since the previous one (two minutes of overlap).
			const hourAgo = new Date(Date.now() - 60 * 60_000).toISOString().replace('T', ' ').replace('Z', '');
			await dataSource.query('UPDATE "document" SET "updatedAt" = ?', [hourAgo]);
			queue.enqueue.mockClear();
			await service.sweep(connection as never);
			expect(queue.enqueue).not.toHaveBeenCalled();
			await documents().update({ id } as never, { name: 'Renamed' } as never);
			await service.sweep(connection as never);
			expect((queue.enqueue.mock.calls as unknown as Array<[Row]>).map(([change]) => [change['entityType'], change['gauzyId']])).toEqual([[EverWorksLinkType.DOC, id]]);
		});

		it("captures Gauzy's page and folder writes, never the sync's own nor files", async () => {
			const seen: EverWorksDocumentSignal[] = [];
			const subscription = EVER_WORKS_DOCUMENT_SIGNALS.subscribe((signal) => seen.push(signal));
			const subscriber = new EverWorksDocumentSubscriber();
			const node = { id: 'd1', tenantId: T, organizationId: O, kind: DocumentKindEnum.PAGE } as never;
			await subscriber.afterEntityUpdate(node);
			await EverWorksSyncContext.run({ connectionId: 'c1' }, () => subscriber.afterEntityUpdate(node));
			await subscriber.afterEntityUpdate({ id: 'f1', tenantId: T, organizationId: O, kind: DocumentKindEnum.FILE } as never);
			await subscriber.afterEntitySoftRemove({ id: 'd2', tenantId: T, organizationId: O, kind: DocumentKindEnum.FOLDER } as never);
			subscription.unsubscribe();
			expect(seen.map((signal) => [signal.documentId, signal.kind, signal.deleted])).toEqual([
				['d1', DocumentKindEnum.PAGE, false],
				['d2', DocumentKindEnum.FOLDER, true]
			]);
		});
	});
});
