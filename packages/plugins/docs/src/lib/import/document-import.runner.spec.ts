import {
	DocumentImportItemStatusEnum,
	DocumentImportLayoutEnum,
	DocumentImportPhaseEnum,
	DocumentImportStatusEnum,
	DocumentKindEnum,
	DocumentVisibilityEnum,
	ID
} from '@gauzy/contracts';
import { DOCS_IMPORT_NO_PAGES, DOCS_IMPORT_PROGRESS_EVERY, DOCS_IMPORT_SYMLINK } from '../docs.constants';
import { IDocNode } from '../services/document-markdown';
import { createImportZip, IImportZipEntry, TINY_PNG, TINY_PDF } from './__fixtures__/import-zip.fixture';
import { DOCS_IMPORT_FAILED, DOCS_IMPORT_REASONS, DocumentImportRunner, parseImportOptions } from './document-import.runner';
import { ICreateImportedFile, ICreateImportedNode, IDocumentImportStore, IImportedDocumentRef, IImportRow, IImportScope } from './document-import.types';
import { IImportArchiveLimits } from './import-archive';

const SCOPE: IImportScope = { tenantId: 'tenant-1', organizationId: 'org-1' };
const LIMITS: IImportArchiveLimits = { maxEntries: 1000, maxUncompressedBytes: 50 * 1024 * 1024, maxRatio: 200, ratioMinBytes: 1024 * 1024 };
const ID32 = '3f2a5c7e9b1d4f6a8c0e2b4d6f8a0c1e';

interface IStoredDocument extends IImportedDocumentRef {
	parentId: ID | null;
	externalSource: string;
	externalId: string;
	icon?: string;
	createdAt?: Date;
	index: number;
	visibility: DocumentVisibilityEnum;
	ownerUserId: ID | null;
	contentJson?: IDocNode;
	/** The content revision (1 as created; a save moves it). */
	revision: number;
	links: ID[];
}

/** An in-memory store: one import row, the documents it creates, failure injection. */
class MemoryStore implements IDocumentImportStore {
	row: IImportRow;
	documents: IStoredDocument[] = [];
	updates: Partial<IImportRow>[] = [];
	discarded = 0;
	used = 0;
	/** Throws on the n-th create (1-based), once. */
	failOnCreate?: number;
	/** Called after each write of the row (a test takes the import over, or edits a page, from here). */
	afterUpdate?: (patch: Partial<IImportRow>) => void;
	/** The documents an earlier run made, stamped again by a resumed run. */
	adopted: ID[] = [];
	private creates = 0;

	constructor(
		private archive: Buffer,
		row: Partial<IImportRow> = {}
	) {
		this.row = {
			id: 'import-1',
			tenantId: SCOPE.tenantId,
			organizationId: SCOPE.organizationId,
			status: DocumentImportStatusEnum.QUEUED,
			fileName: 'vault.zip',
			parentId: 'target-page',
			visibility: DocumentVisibilityEnum.ORGANIZATION,
			createdByUserId: 'user-1',
			optionsJson: JSON.stringify({ quotaBytes: 0, importToKnowledge: false, maxFileSize: 10 * 1024 * 1024, limits: LIMITS, initiatedByUserId: 'user-1' }),
			...row
		};
	}

	async load(id: ID): Promise<IImportRow | null> {
		return id === this.row.id ? { ...this.row } : null;
	}
	claims = 0;
	async claim(_id: ID, _scope: IImportScope, staleBefore: Date, patch: Partial<IImportRow>): Promise<boolean> {
		const stale = this.row.status === DocumentImportStatusEnum.RUNNING && (this.row.lastProgressAt ?? new Date(0)) < staleBefore;
		if (this.row.status !== DocumentImportStatusEnum.QUEUED && !stale) return false;
		this.claims += 1;
		this.row = { ...this.row, ...patch };
		return true;
	}
	async update(_id: ID, _scope: IImportScope, patch: Partial<IImportRow>, fence?: number): Promise<boolean> {
		// A fenced write lands only while the import is still that run's (no later claim moved `attempts`) and RUNNING
		// (the stalled-import sweep did not send it back to QUEUED, or give it up).
		if (fence !== undefined && (fence !== this.row.attempts || this.row.status !== DocumentImportStatusEnum.RUNNING)) return false;
		this.updates.push(patch);
		this.row = { ...this.row, ...patch };
		this.afterUpdate?.(patch);
		return true;
	}
	async readArchive(): Promise<Buffer> {
		return this.archive;
	}
	async discardArchive(_row: IImportRow, fence?: number): Promise<void> {
		if (fence !== undefined && fence !== this.row.attempts) return;
		this.discarded += 1;
	}
	async adoptImported(id: ID): Promise<void> {
		this.adopted.push(id);
	}
	async findImported(_scope: IImportScope, externalSource: string, externalId: string): Promise<IImportedDocumentRef | null> {
		return this.documents.find((doc) => doc.externalSource === externalSource && doc.externalId === externalId) ?? null;
	}
	private nextId(kind: string): ID {
		this.creates += 1;
		if (this.failOnCreate === this.creates) {
			this.failOnCreate = undefined;
			throw new Error('database went away');
		}
		return `${kind.toLowerCase()}-${this.documents.length + 1}`;
	}
	async createNode(input: ICreateImportedNode): Promise<IImportedDocumentRef> {
		const doc: IStoredDocument = { ...pick(input), id: this.nextId(input.kind), kind: input.kind, name: input.name, revision: 1, links: [] };
		this.documents.push(doc);
		return doc;
	}
	async createFile(input: ICreateImportedFile): Promise<IImportedDocumentRef> {
		const doc: IStoredDocument = {
			...pick(input),
			id: this.nextId('FILE'),
			kind: DocumentKindEnum.FILE,
			name: input.name,
			mimeType: input.mimeType,
			fileSize: input.buffer.length,
			revision: 1,
			links: []
		};
		this.documents.push(doc);
		return doc;
	}
	async writePage(document: IImportedDocumentRef, _scope: IImportScope, contentJson: IDocNode): Promise<boolean> {
		const doc = this.byId(document.id) as IStoredDocument;
		// The guarded content write: only a page as it was created.
		if (doc.revision !== 1) return false;
		doc.contentJson = contentJson;
		doc.revision = 2;
		return true;
	}
	async mentionsOf(documentId: ID): Promise<Set<string>> {
		return new Set(all(this.byId(documentId)?.contentJson, 'documentMention').map((node) => String(node.attrs?.['id'])));
	}
	async linkPages(documentId: ID, mentionedIds: ID[]): Promise<void> {
		(this.byId(documentId) as IStoredDocument).links = mentionedIds;
	}
	/** What the organization stores: the bytes before the import, and every file stored since (this run's too). */
	async usedBytes(): Promise<number> {
		return this.used + this.documents.reduce((total, doc) => total + (doc.fileSize ?? 0), 0);
	}
	byId(id: ID): IStoredDocument | undefined {
		return this.documents.find((doc) => doc.id === id);
	}
	byName(name: string): IStoredDocument {
		const doc = this.documents.find((item) => item.name === name);
		if (!doc) throw new Error(`no document named ${name}`);
		return doc;
	}
}

function pick(input: ICreateImportedNode | ICreateImportedFile) {
	return {
		parentId: input.parentId,
		externalSource: input.externalSource,
		externalId: input.externalId,
		index: input.index,
		visibility: input.visibility,
		ownerUserId: input.ownerUserId,
		...('icon' in input && input.icon ? { icon: input.icon } : {}),
		...(input.createdAt ? { createdAt: input.createdAt } : {})
	};
}

/** Every node of a type in a document, depth first. */
function all(node: IDocNode | undefined, type: string): IDocNode[] {
	if (!node) return [];
	const found = node.type === type ? [node] : [];
	return found.concat(...(node.content ?? []).map((child) => all(child, type)));
}

const VAULT: IImportZipEntry[] = [
	{ name: 'Vault/' },
	{ name: 'Vault/Home.md', data: '---\nicon: 🏠\ncreated: 2023-05-01\n---\n# Home\n\nSee [[Release checklist]] and ![[diagram.png]] and ![[spec.pdf]].\n' },
	{ name: 'Vault/Projects/Release checklist.md', data: '- [ ] tag\n- [x] build\n\nBack to [[Home|the start]].', deflate: true },
	{ name: 'Vault/assets/diagram.png', data: TINY_PNG },
	{ name: 'Vault/assets/spec.pdf', data: TINY_PDF },
	{ name: 'Vault/assets/tool.exe', data: Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0xff, 0xff]) },
	{ name: 'Vault/.settings/app.json', data: '{}' }
];

describe('DocumentImportRunner', () => {
	it('imports a vault: the tree, the pages with their links, the attachments under the page that shows them', async () => {
		const store = new MemoryStore(createImportZip(VAULT));
		const outcome = await new DocumentImportRunner(store).run('import-1', SCOPE, LIMITS);

		expect(outcome).toEqual({ status: DocumentImportStatusEnum.COMPLETED, importedCount: 7, skippedCount: 1, failedCount: 0 });
		expect(store.row).toMatchObject({ status: DocumentImportStatusEnum.COMPLETED, phase: DocumentImportPhaseEnum.DONE, layout: DocumentImportLayoutEnum.MARKDOWN_VAULT, attempts: 1 });
		expect(store.row.processedItems).toBe(store.row.totalItems);
		expect(store.discarded).toBe(1);

		const vault = store.byName('Vault');
		const home = store.byName('Home');
		const projects = store.byName('Projects');
		const release = store.byName('Release checklist');
		expect(vault).toMatchObject({ kind: DocumentKindEnum.FOLDER, parentId: 'target-page', ownerUserId: 'user-1', externalSource: 'docs-import:import-1' });
		expect(home).toMatchObject({ kind: DocumentKindEnum.PAGE, parentId: vault.id, icon: '🏠', createdAt: new Date('2023-05-01') });
		expect(release).toMatchObject({ parentId: projects.id });
		// The attachments go under the page that shows them; the folder `assets` stays a folder.
		expect(store.byName('diagram.png')).toMatchObject({ kind: DocumentKindEnum.FILE, parentId: home.id, mimeType: 'image/png' });
		expect(store.byName('spec.pdf')).toMatchObject({ parentId: home.id, mimeType: 'application/pdf' });

		// Home: its title heading dropped, a mention of the release page, the stored image, the PDF as a link inside text.
		expect(home.contentJson?.content?.[0].type).toBe('paragraph');
		expect(all(home.contentJson, 'documentMention')[0].attrs).toMatchObject({ id: release.id, label: 'Release checklist' });
		expect(all(home.contentJson, 'image')[0].attrs).toMatchObject({ documentId: store.byName('diagram.png').id });
		expect(home.links).toEqual([release.id]);
		expect(all(release.contentJson, 'documentMention')[0].attrs).toMatchObject({ id: home.id, label: 'the start' });
		expect(all(release.contentJson, 'taskItem')).toHaveLength(2);

		const report = JSON.parse(store.row.reportJson as string);
		expect(report.items.find((item: any) => item.path === 'Vault/assets/tool.exe')).toMatchObject({
			status: DocumentImportItemStatusEnum.SKIPPED,
			reason: DOCS_IMPORT_REASONS.UNSUPPORTED_TYPE
		});
		expect(report.items.some((item: any) => item.path.includes('.settings'))).toBe(false);
	});

	it('resumes an interrupted run without creating anything twice', async () => {
		const store = new MemoryStore(createImportZip(VAULT));
		store.failOnCreate = 4;
		const runner = new DocumentImportRunner(store);

		await expect(runner.run('import-1', SCOPE, LIMITS, false)).rejects.toThrow('database went away');
		expect(store.row.status).toBe(DocumentImportStatusEnum.QUEUED);
		const createdBefore = store.documents.length;
		expect(createdBefore).toBe(3);

		const outcome = await runner.run('import-1', SCOPE, LIMITS, true);
		expect(outcome?.status).toBe(DocumentImportStatusEnum.COMPLETED);
		expect(store.row.attempts).toBe(2);
		const keys = store.documents.map((doc) => doc.externalId);
		expect(new Set(keys).size).toBe(keys.length);
		// Vault, assets, Home, Projects, Release checklist, diagram.png, spec.pdf (the .exe is skipped, the hidden file ignored).
		expect(store.documents).toHaveLength(7);
		expect(store.row.importedCount).toBe(7);
	});

	it('stops a run that a later claim took over: no more writes, and the zip left to the run that owns it', async () => {
		const store = new MemoryStore(createImportZip(VAULT));
		// Another worker claims the import (a stall past the stale window) as this run finishes its tree.
		store.afterUpdate = (patch) => {
			if (patch.phase === DocumentImportPhaseEnum.TREE) store.row = { ...store.row, attempts: (store.row.attempts ?? 0) + 1 };
		};
		const outcome = await new DocumentImportRunner(store).run('import-1', SCOPE, LIMITS);

		expect(outcome).toBeNull();
		// Neither COMPLETED nor FAILED nor QUEUED by the displaced run; its zip is not deleted.
		expect(store.row.status).toBe(DocumentImportStatusEnum.RUNNING);
		expect(store.row.phase).toBe(DocumentImportPhaseEnum.TREE);
		expect(store.discarded).toBe(0);
	});

	it('stamps again the documents an earlier run made, when it resumes', async () => {
		const store = new MemoryStore(createImportZip(VAULT));
		store.failOnCreate = 4;
		const runner = new DocumentImportRunner(store);
		await expect(runner.run('import-1', SCOPE, LIMITS, false)).rejects.toThrow('database went away');
		const madeBefore = store.documents.map((doc) => doc.id);

		await runner.run('import-1', SCOPE, LIMITS, true);
		expect(store.adopted).toEqual(expect.arrayContaining(madeBefore));
	});

	it('leaves a page saved meanwhile as it is, and writes the others', async () => {
		const store = new MemoryStore(createImportZip(VAULT));
		// A member saves Home while the import builds the tree.
		store.afterUpdate = (patch) => {
			if (patch.phase === DocumentImportPhaseEnum.CONTENT) store.byName('Home').revision = 2;
		};
		const outcome = await new DocumentImportRunner(store).run('import-1', SCOPE, LIMITS);

		expect(outcome?.status).toBe(DocumentImportStatusEnum.COMPLETED);
		expect(store.byName('Home').contentJson).toBeUndefined();
		expect(store.byName('Release checklist').contentJson).toBeDefined();
	});

	it('links a page saved meanwhile only to the pages it still mentions', async () => {
		const store = new MemoryStore(createImportZip(VAULT));
		// A member saves Home without the mention of the release page while the import builds the tree.
		store.afterUpdate = (patch) => {
			if (patch.phase !== DocumentImportPhaseEnum.CONTENT) return;
			const home = store.byName('Home');
			home.revision = 2;
			home.contentJson = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rewritten' }] }] };
		};
		await new DocumentImportRunner(store).run('import-1', SCOPE, LIMITS);

		expect(store.byName('Home').links).toEqual([]);
		expect(store.byName('Release checklist').links).toEqual([store.byName('Home').id]);
	});

	it('links again what an earlier run wrote before it stopped', async () => {
		const store = new MemoryStore(createImportZip(VAULT));
		// An earlier run wrote Home (the same content, its mention included) and stopped before linking it.
		store.afterUpdate = (patch) => {
			if (patch.phase !== DocumentImportPhaseEnum.CONTENT) return;
			const home = store.byName('Home');
			home.revision = 2;
			home.contentJson = {
				type: 'doc',
				content: [{ type: 'paragraph', content: [{ type: 'documentMention', attrs: { id: store.byName('Release checklist').id, label: 'Release checklist' } }] }]
			};
		};
		await new DocumentImportRunner(store).run('import-1', SCOPE, LIMITS);

		expect(store.byName('Home').links).toEqual([store.byName('Release checklist').id]);
	});

	it('stops a run, on its last attempt too, that loses the import while it stores the attachments', async () => {
		const files = Array.from({ length: 30 }, (_, index) => ({ name: `assets/picture-${index}.png`, data: TINY_PNG }));
		const store = new MemoryStore(createImportZip([{ name: 'Home.md', data: '# Home' }, ...files]));
		const createFile = store.createFile.bind(store);
		let stored = 0;
		// Another worker claims the import (a stall past the stale window) after the tenth file.
		store.createFile = async (input) => {
			const created = await createFile(input);
			if (++stored === 10) store.row = { ...store.row, attempts: (store.row.attempts ?? 0) + 1 };
			return created;
		};
		const outcome = await new DocumentImportRunner(store).run('import-1', SCOPE, LIMITS, true);

		expect(outcome).toBeNull();
		// The first refused progress write stops it: the files after it are left to the run that owns the import.
		expect(stored).toBeLessThanOrEqual(DOCS_IMPORT_PROGRESS_EVERY);
		expect(store.row.status).toBe(DocumentImportStatusEnum.RUNNING);
		expect(store.discarded).toBe(0);
	});

	it('stops a run the stalled-import sweep sent back to QUEUED', async () => {
		const store = new MemoryStore(createImportZip(VAULT));
		// The sweep found the import stalled and re-enqueued it (`attempts` unchanged) while this run was still alive.
		store.afterUpdate = (patch) => {
			if (patch.phase === DocumentImportPhaseEnum.TREE) store.row = { ...store.row, status: DocumentImportStatusEnum.QUEUED };
		};
		const outcome = await new DocumentImportRunner(store).run('import-1', SCOPE, LIMITS);

		expect(outcome).toBeNull();
		expect(store.row.status).toBe(DocumentImportStatusEnum.QUEUED);
		expect(store.discarded).toBe(0);
	});

	it('skips the attachments past the quota and keeps the pages', async () => {
		const store = new MemoryStore(createImportZip(VAULT), {
			optionsJson: JSON.stringify({ quotaBytes: 1000, maxFileSize: 1024 * 1024, limits: LIMITS, initiatedByUserId: 'user-1' })
		});
		store.used = 950;
		await new DocumentImportRunner(store).run('import-1', SCOPE, LIMITS);

		const report = JSON.parse(store.row.reportJson as string);
		const reasons = Object.fromEntries(report.items.map((item: any) => [item.path, item.reason]));
		expect(reasons['Vault/assets/diagram.png']).toBe(DOCS_IMPORT_REASONS.QUOTA_EXCEEDED);
		expect(reasons['Vault/assets/spec.pdf']).toBe(DOCS_IMPORT_REASONS.QUOTA_EXCEEDED);
		expect(store.byName('Home').contentJson).toBeDefined();
		// The image that was not imported is its alternative text, and counted as unresolved.
		expect(all(store.byName('Home').contentJson, 'image')).toHaveLength(0);
		expect(report.items.find((item: any) => item.path === 'Vault/Home.md').unresolvedLinks).toBe(2);
	});

	it('imports an HTML export: titles, icons and dates from the export, ids stripped', async () => {
		const page = (title: string, body: string, icon = '') =>
			`<html><head><title>${title}</title></head><body><article><header>${icon ? `<div class="page-header-icon"><span class="icon">${icon}</span></div>` : ''}<h1 class="page-title">${title}</h1><table class="properties"><tr><th>Created</th><td><time>@January 9, 2024 9:00 AM</time></td></tr></table></header><div class="page-body">${body}</div></article></body></html>`;
		const zip = createImportZip([
			{ name: `Roadmap ${ID32}.html`, data: page('Roadmap: 2024', `<p>See <a href="Roadmap%20${ID32}/Q1%20${'b'.repeat(32)}.html">Q1</a></p>`, '🗺️') },
			{ name: `Roadmap ${ID32}/Q1 ${'b'.repeat(32)}.html`, data: page('Q1 plan', '<p>Back to <a href="../Roadmap%20' + ID32 + '.html">Roadmap</a></p>') }
		]);
		const store = new MemoryStore(zip);
		await new DocumentImportRunner(store).run('import-1', SCOPE, LIMITS);

		expect(store.row.layout).toBe(DocumentImportLayoutEnum.HTML_EXPORT);
		const roadmap = store.byName('Roadmap: 2024');
		const q1 = store.byName('Q1 plan');
		expect(roadmap).toMatchObject({ icon: '🗺️', parentId: 'target-page' });
		expect(roadmap.createdAt?.getFullYear()).toBe(2024);
		expect(q1.parentId).toBe(roadmap.id);
		expect(all(roadmap.contentJson, 'documentMention')[0].attrs).toMatchObject({ id: q1.id, label: 'Q1' });
		expect(all(q1.contentJson, 'documentMention')[0].attrs).toMatchObject({ id: roadmap.id });
	});

	it('fails an archive the inspection refuses, with its code, and deletes it', async () => {
		const store = new MemoryStore(createImportZip([{ name: 'Home.md', data: 'x' }, { name: 'evil.md', data: '/etc', unixMode: 0o120777 }]));
		const outcome = await new DocumentImportRunner(store).run('import-1', SCOPE, LIMITS, false);
		expect(outcome?.status).toBe(DocumentImportStatusEnum.FAILED);
		expect(store.row).toMatchObject({ status: DocumentImportStatusEnum.FAILED, errorCode: DOCS_IMPORT_SYMLINK });
		expect(store.documents).toHaveLength(0);
		expect(store.discarded).toBe(1);
	});

	it('fails an archive without a page file', async () => {
		const store = new MemoryStore(createImportZip([{ name: 'a.png', data: TINY_PNG }]));
		await new DocumentImportRunner(store).run('import-1', SCOPE, LIMITS);
		expect(store.row.errorCode).toBe(DOCS_IMPORT_NO_PAGES);
	});

	it('ends FAILED on the last attempt of an unexpected error', async () => {
		const store = new MemoryStore(createImportZip(VAULT));
		store.readArchive = async () => {
			throw new Error('storage is down');
		};
		await new DocumentImportRunner(store).run('import-1', SCOPE, LIMITS, true);
		expect(store.row).toMatchObject({ status: DocumentImportStatusEnum.FAILED, errorCode: DOCS_IMPORT_FAILED, errorMessage: 'storage is down' });
	});

	it('on the last attempt, reports an item it cannot create and imports the rest', async () => {
		const store = new MemoryStore(createImportZip(VAULT));
		store.failOnCreate = 1;
		const outcome = await new DocumentImportRunner(store).run('import-1', SCOPE, LIMITS, true);
		expect(outcome?.status).toBe(DocumentImportStatusEnum.COMPLETED);
		const report = JSON.parse(store.row.reportJson as string);
		expect(report.items.find((item: any) => item.path === 'Vault')).toMatchObject({ status: DocumentImportItemStatusEnum.FAILED, reason: DOCS_IMPORT_REASONS.CREATE_FAILED });
		// What was under the folder that failed has no parent to go under.
		expect(report.items.find((item: any) => item.path === 'Vault/Home.md')).toMatchObject({ status: DocumentImportItemStatusEnum.SKIPPED, reason: DOCS_IMPORT_REASONS.PARENT_MISSING });
	});

	it('writes every page when the report stops keeping items, and keeps the counts exact', async () => {
		const store = new MemoryStore(createImportZip(VAULT));
		const runner = new DocumentImportRunner(store);
		runner.reportMaxItems = 2;
		const outcome = await runner.run('import-1', SCOPE, LIMITS);
		expect(outcome).toMatchObject({ importedCount: 7, skippedCount: 1 });
		expect(store.byName('Release checklist').contentJson).toBeDefined();
		const report = JSON.parse(store.row.reportJson as string);
		expect(report.items).toHaveLength(2);
		expect(report.truncated).toBe(true);
	});

	it('refuses an archive whose entry lies about its size before creating anything', async () => {
		const store = new MemoryStore(createImportZip([{ name: 'Home.md', data: 'x' }, { name: 'liar.md', data: Buffer.alloc(4096, 0x62), deflate: true, declaredSize: 10 }]));
		await new DocumentImportRunner(store).run('import-1', SCOPE, LIMITS);
		expect(store.row.errorCode).toBe('DOCS_IMPORT_ZIP_BOMB');
		expect(store.documents).toHaveLength(0);
	});

	it('does not start while another run holds the import', async () => {
		const store = new MemoryStore(createImportZip(VAULT), { status: DocumentImportStatusEnum.RUNNING, lastProgressAt: new Date() });
		expect(await new DocumentImportRunner(store).run('import-1', SCOPE, LIMITS)).toBeNull();
		expect(store.documents).toHaveLength(0);
		expect(store.claims).toBe(0);
	});

	it('puts a retried import back to QUEUED, so the retry can claim it', async () => {
		const store = new MemoryStore(createImportZip(VAULT));
		store.failOnCreate = 2;
		await expect(new DocumentImportRunner(store).run('import-1', SCOPE, LIMITS, false)).rejects.toThrow();
		expect(store.row.status).toBe(DocumentImportStatusEnum.QUEUED);
	});

	it('does not run a finished import again, nor one it cannot find', async () => {
		const store = new MemoryStore(createImportZip(VAULT), { status: DocumentImportStatusEnum.COMPLETED, importedCount: 3 });
		expect(await new DocumentImportRunner(store).run('import-1', SCOPE, LIMITS)).toMatchObject({ status: DocumentImportStatusEnum.COMPLETED, importedCount: 3 });
		expect(store.updates).toHaveLength(0);
		expect(await new DocumentImportRunner(store).run('other', SCOPE, LIMITS)).toBeNull();
	});

	it('creates TEAM pages in their team, and nothing else carries a team', async () => {
		const store = new MemoryStore(createImportZip([{ name: 'Home.md', data: 'x' }]), { visibility: DocumentVisibilityEnum.TEAM, organizationTeamId: 'team-1', parentId: null });
		await new DocumentImportRunner(store).run('import-1', SCOPE, LIMITS);
		expect(store.byName('Home')).toMatchObject({ visibility: DocumentVisibilityEnum.TEAM, parentId: null });
	});
});

describe('parseImportOptions', () => {
	it('falls back to safe values', () => {
		expect(parseImportOptions('not json', LIMITS)).toEqual({ quotaBytes: 0, importToKnowledge: false, maxFileSize: 50 * 1024 * 1024, limits: LIMITS, initiatedByUserId: null });
		expect(parseImportOptions(JSON.stringify({ quotaBytes: 5, limits: { maxEntries: 3 } }), LIMITS)).toMatchObject({ quotaBytes: 5, limits: { ...LIMITS, maxEntries: 3 } });
	});
});
