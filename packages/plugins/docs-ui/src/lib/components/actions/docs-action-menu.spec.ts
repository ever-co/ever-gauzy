import { NbMenuItem } from '@nebular/theme';
import { DocumentKindEnum, DocumentKnowledgeStatusEnum, ID, IDocument } from '@gauzy/contracts';
import {
	buildDocsActionMenu,
	docsActionMenuSignature,
	docsActionOf,
	toDocsActionTarget,
	DocsActionId,
	IDocsActionMenuContext,
	IDocsActionPermissions,
	IDocsActionTarget
} from './docs-action-menu';

const DOCUMENT_ID = 'aaaaaaaa-1111-4111-8111-111111111111' as ID;

const ALL_PERMISSIONS: IDocsActionPermissions = { create: true, update: true, delete: true, aiImport: true };
const NO_PERMISSIONS: IDocsActionPermissions = { create: false, update: false, delete: false, aiImport: false };

/** The builder is handed the component's `getTranslation`; here the key IS the label. */
const translate = (key: string) => key;

function context(overrides: Partial<IDocsActionMenuContext> = {}): IDocsActionMenuContext {
	return { surface: 'tree', translate, permissions: ALL_PERMISSIONS, ...overrides };
}

function target(overrides: Partial<IDocsActionTarget> = {}): IDocsActionTarget {
	return { id: DOCUMENT_ID, kind: DocumentKindEnum.PAGE, name: 'Handbook', ...overrides };
}

const actionsOf = (items: NbMenuItem[]): DocsActionId[] =>
	items.map((item) => docsActionOf(item)).filter((action): action is DocsActionId => !!action);

describe('buildDocsActionMenu — one action set for tree, table and cards', () => {
	describe('per kind (01-ux-spec §3.5)', () => {
		it('offers create-inside only on containers', () => {
			const folder = actionsOf(buildDocsActionMenu(target({ kind: DocumentKindEnum.FOLDER }), context()));
			const file = actionsOf(buildDocsActionMenu(target({ kind: DocumentKindEnum.FILE }), context()));

			expect(folder).toEqual(expect.arrayContaining(['new-page', 'new-folder', 'upload-here']));
			expect(file).not.toEqual(expect.arrayContaining(['new-page', 'new-folder', 'upload-here']));
		});

		it('offers Download for a FILE and Export markdown for a PAGE, never the other way round', () => {
			const file = actionsOf(buildDocsActionMenu(target({ kind: DocumentKindEnum.FILE }), context()));
			const page = actionsOf(buildDocsActionMenu(target({ kind: DocumentKindEnum.PAGE }), context()));

			expect(file).toContain('download');
			expect(file).not.toContain('export-markdown');
			expect(page).toContain('export-markdown');
			expect(page).not.toContain('download');
		});

		it('offers the deep duplicate only where there is a subtree to copy', () => {
			expect(actionsOf(buildDocsActionMenu(target({ kind: DocumentKindEnum.FOLDER }), context()))).toContain(
				'duplicate-deep'
			);
			expect(actionsOf(buildDocsActionMenu(target({ kind: DocumentKindEnum.FILE }), context()))).not.toContain(
				'duplicate-deep'
			);
		});

		it('never offers AI knowledge on a FOLDER (there is no body to index)', () => {
			const folder = actionsOf(buildDocsActionMenu(target({ kind: DocumentKindEnum.FOLDER }), context()));

			expect(folder).not.toContain('knowledge-import');
			expect(folder).not.toContain('knowledge-exclude');
		});

		it('offers Copy link and Favorite for every kind', () => {
			for (const kind of Object.values(DocumentKindEnum)) {
				const items = actionsOf(buildDocsActionMenu(target({ kind }), context()));
				expect(items).toEqual(expect.arrayContaining(['copy-link', 'favorite']));
			}
		});
	});

	describe('permission filtering', () => {
		it('drops every mutating item for a read-only viewer, keeping the read-only ones', () => {
			const items = actionsOf(buildDocsActionMenu(target(), context({ permissions: NO_PERMISSIONS })));

			expect(items).toEqual(['open', 'favorite', 'copy-link', 'export-markdown']);
		});

		// `POST /documents/:id/duplicate` is `@Permissions(DOCS_CREATE)`, so gating the
		// item on DOCS_UPDATE offers an action the backend answers with a 403.
		it('gates Duplicate on DOCS_CREATE, not DOCS_UPDATE', () => {
			const updateOnly = actionsOf(
				buildDocsActionMenu(target(), context({ permissions: { ...NO_PERMISSIONS, update: true } }))
			);
			const createOnly = actionsOf(
				buildDocsActionMenu(target(), context({ permissions: { ...NO_PERMISSIONS, create: true } }))
			);

			expect(updateOnly).not.toContain('duplicate');
			expect(createOnly).toContain('duplicate');
		});

		it('gates the knowledge items on DOCS_AI_IMPORT', () => {
			expect(
				actionsOf(buildDocsActionMenu(target(), context({ permissions: { ...NO_PERMISSIONS, aiImport: true } })))
			).toContain('knowledge-import');
		});
	});

	// `08-permissions-security.md` §1.7/§1.8: the verb permission and the row-level ownership
	// scope are two independent conditions, exactly as in `isDocumentWritable` on the server.
	describe('ownership scoping (canMutate)', () => {
		it('drops edit / relocate / archive for a DOCS_UPDATE holder who may not mutate this row', () => {
			const items = actionsOf(buildDocsActionMenu(target(), context({ canMutate: false })));

			expect(items).not.toContain('rename');
			expect(items).not.toContain('move');
			expect(items).not.toContain('archive');
		});

		it('drops Delete on an archived row the user may not mutate', () => {
			const items = actionsOf(buildDocsActionMenu(target({ isArchived: true }), context({ canMutate: false })));

			expect(items).not.toContain('delete');
			expect(items).not.toContain('restore');
		});

		// Duplicate WRITES a new document, so it follows DOCS_CREATE and is never ownership
		// scoped (§1.8 "Duplicate a readable document" — ✓, not **own**).
		it('keeps the read-only affordances and Duplicate', () => {
			const items = actionsOf(buildDocsActionMenu(target(), context({ canMutate: false })));

			expect(items).toEqual(expect.arrayContaining(['open', 'favorite', 'copy-link', 'duplicate']));
		});

		it('defaults to permissive when the caller has not resolved ownership', () => {
			expect(actionsOf(buildDocsActionMenu(target(), context()))).toContain('rename');
		});
	});

	describe('archive-first delete rule', () => {
		it('offers Archive on a live row and Restore on an archived one — never both', () => {
			const live = actionsOf(buildDocsActionMenu(target(), context()));
			const archived = actionsOf(buildDocsActionMenu(target({ isArchived: true }), context()));

			expect(live).toContain('archive');
			expect(live).not.toContain('restore');
			expect(archived).toContain('restore');
			expect(archived).not.toContain('archive');
		});

		// `DELETE /documents/:id` answers 409 DOCS_DELETE_REQUIRES_ARCHIVE for a live row.
		it('offers Delete only on an archived row, and only with DOCS_DELETE', () => {
			expect(actionsOf(buildDocsActionMenu(target(), context()))).not.toContain('delete');
			expect(actionsOf(buildDocsActionMenu(target({ isArchived: true }), context()))).toContain('delete');
			expect(
				actionsOf(
					buildDocsActionMenu(
						target({ isArchived: true }),
						context({ permissions: { ...ALL_PERMISSIONS, delete: false } })
					)
				)
			).not.toContain('delete');
		});

		it('hides create/rename/duplicate on an archived row — they would produce invisible documents', () => {
			const archived = actionsOf(buildDocsActionMenu(target({ isArchived: true }), context()));

			expect(archived).not.toEqual(expect.arrayContaining(['new-page', 'rename', 'move', 'duplicate']));
		});
	});

	describe('AI knowledge state', () => {
		it.each([
			[DocumentKnowledgeStatusEnum.QUEUED, 'knowledge-exclude'],
			[DocumentKnowledgeStatusEnum.INDEXING, 'knowledge-exclude'],
			[DocumentKnowledgeStatusEnum.INDEXED, 'knowledge-exclude'],
			[DocumentKnowledgeStatusEnum.NONE, 'knowledge-import'],
			[DocumentKnowledgeStatusEnum.EXCLUDED, 'knowledge-import'],
			[DocumentKnowledgeStatusEnum.FAILED, 'knowledge-import']
		])('offers %s → %s', (knowledgeStatus, expected) => {
			const items = actionsOf(buildDocsActionMenu(target({ knowledgeStatus }), context()));

			expect(items).toContain(expected);
			expect(items).not.toContain(expected === 'knowledge-import' ? 'knowledge-exclude' : 'knowledge-import');
		});
	});

	describe('surface', () => {
		// §4.1 column 9: "same action set as the tree context menu plus Details and Preview".
		it('adds Details everywhere and Preview on a FILE, in content views only', () => {
			const treeFile = actionsOf(buildDocsActionMenu(target({ kind: DocumentKindEnum.FILE }), context()));
			const rowFile = actionsOf(
				buildDocsActionMenu(target({ kind: DocumentKindEnum.FILE }), context({ surface: 'row' }))
			);
			const rowPage = actionsOf(buildDocsActionMenu(target(), context({ surface: 'row' })));

			expect(treeFile).not.toEqual(expect.arrayContaining(['details', 'preview']));
			expect(rowFile).toEqual(expect.arrayContaining(['details', 'preview']));
			expect(rowPage).toContain('details');
			expect(rowPage).not.toContain('preview');
		});

		it('is otherwise identical between the tree and a content view', () => {
			const tree = actionsOf(buildDocsActionMenu(target(), context({ surface: 'tree' })));
			const row = actionsOf(buildDocsActionMenu(target(), context({ surface: 'row' })));

			expect(row.filter((action) => action !== 'details' && action !== 'preview')).toEqual(tree);
		});
	});

	it('flips the favorite label with the star state', () => {
		const notStarred = buildDocsActionMenu(target(), context({ isFavorite: false }));
		const starred = buildDocsActionMenu(target(), context({ isFavorite: true }));

		expect(notStarred.find((item) => docsActionOf(item) === 'favorite')?.title).toBe('BUTTONS.ADD_TO_FAVORITES');
		expect(starred.find((item) => docsActionOf(item) === 'favorite')?.title).toBe('BUTTONS.REMOVE_FROM_FAVORITES');
	});

	it('carries the action id on `data.action` so callers never match on a translated title', () => {
		const items = buildDocsActionMenu(target(), context());

		expect(items.every((item) => !!docsActionOf(item))).toBe(true);
		expect(docsActionOf(undefined)).toBeUndefined();
		expect(docsActionOf({ title: 'x' } as NbMenuItem)).toBeUndefined();
	});
});

describe('docsActionMenuSignature — the memo key the kebab bindings rely on', () => {
	// `[nbContextMenu]` rebuilds its overlay on every new array reference, so the
	// callers memoize; a signature that missed an input would freeze a stale menu.
	it.each([
		['kind', target({ kind: DocumentKindEnum.FILE })],
		['archived', target({ isArchived: true })],
		['knowledge status', target({ knowledgeStatus: DocumentKnowledgeStatusEnum.INDEXED })]
	])('changes when the %s changes', (_label, changed) => {
		expect(docsActionMenuSignature(changed, context())).not.toBe(docsActionMenuSignature(target(), context()));
	});

	it('changes when a permission, the star state or the surface changes', () => {
		const base = docsActionMenuSignature(target(), context());

		expect(docsActionMenuSignature(target(), context({ permissions: NO_PERMISSIONS }))).not.toBe(base);
		expect(docsActionMenuSignature(target(), context({ isFavorite: true }))).not.toBe(base);
		expect(docsActionMenuSignature(target(), context({ surface: 'row' }))).not.toBe(base);
		// Ownership flips per row and per user; a signature that ignored it would serve a
		// creator's menu from the memo for someone else's document.
		expect(docsActionMenuSignature(target(), context({ canMutate: false }))).not.toBe(base);
	});

	it('is stable for an unchanged row (otherwise the memo never hits)', () => {
		expect(docsActionMenuSignature(target(), context())).toBe(docsActionMenuSignature(target(), context()));
	});
});

describe('toDocsActionTarget', () => {
	it('carries the list-projection columns `IDocument` does not declare', () => {
		const row = {
			id: DOCUMENT_ID,
			kind: DocumentKindEnum.FOLDER,
			name: 'Finance',
			parentId: null,
			knowledgeStatus: DocumentKnowledgeStatusEnum.NONE,
			isArchived: true,
			childrenCount: 3
		} as unknown as IDocument;

		expect(toDocsActionTarget(row)).toEqual({
			id: DOCUMENT_ID,
			kind: DocumentKindEnum.FOLDER,
			name: 'Finance',
			parentId: null,
			knowledgeStatus: DocumentKnowledgeStatusEnum.NONE,
			isArchived: true,
			childrenCount: 3
		});
	});
});
