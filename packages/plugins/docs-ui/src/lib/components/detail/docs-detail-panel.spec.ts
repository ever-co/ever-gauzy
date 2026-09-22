/**
 * The panel is exercised by instantiating it directly — the package's established test shape
 * (`document-comments.component.spec.ts`). Both `@gauzy/ui-core` barrels are stubbed: `core`
 * drags Akita's untranspiled ESM into the CommonJS runtime (and is reached transitively through
 * every dialog the panel imports), and `i18n` only contributes the translation base class.
 */
jest.mock('@gauzy/ui-core/core', () => ({
	EmployeesService: class EmployeesService {},
	InvoicesService: class InvoicesService {},
	OrganizationContactService: class OrganizationContactService {},
	OrganizationProjectsService: class OrganizationProjectsService {},
	OrganizationTeamsService: class OrganizationTeamsService {},
	Store: class Store {},
	TagsService: class TagsService {},
	TasksService: class TasksService {},
	ToastrService: class ToastrService {}
}));
jest.mock('@gauzy/ui-core/i18n', () => ({
	TranslationBaseComponent: class TranslationBaseComponent {
		constructor(public readonly translateService: unknown) {}
		getTranslation(key: string): string {
			return key;
		}
	}
}));

import { of, throwError } from 'rxjs';
import { DocumentKindEnum, ID, IDocument, ITag } from '@gauzy/contracts';
import { DocsDetailPanelComponent, DOCS_DETAIL_RELATIONS } from './docs-detail-panel.component';

const DOCUMENT_ID = 'ffffffff-1111-4111-8111-111111111111' as ID;
const PARENT_ID = 'ffffffff-2222-4222-8222-222222222222' as ID;
const GRANDPARENT_ID = 'ffffffff-3333-4333-8333-333333333333' as ID;

const doc = (overrides: Partial<IDocument> = {}): IDocument =>
	({
		id: DOCUMENT_ID,
		kind: DocumentKindEnum.FILE,
		name: 'invoice.pdf',
		tags: [],
		...overrides
	} as unknown as IDocument);

const flush = async (): Promise<void> => {
	for (let index = 0; index < 5; index++) await Promise.resolve();
};

function createPanel(overrides: Record<string, unknown> = {}) {
	// Typed loosely so a test can swap one method for a differently-shaped stub (a throwing
	// `update`, a `getById` that answers per id) without fighting the inferred mock signature.
	const documentsService: Record<string, jest.Mock> = {
		getById: jest.fn(() => of(doc())),
		getLinks: jest.fn(() => of([])),
		getCategories: jest.fn(() => of([])),
		update: jest.fn((id: ID, input: unknown) => of({ id, ...(input as object) } as unknown as IDocument))
	};
	const toastrService = { success: jest.fn(), danger: jest.fn(), warning: jest.fn() };
	const actions = { dispatch: jest.fn() };
	const documentTreeStore: Record<string, jest.Mock> = { pathOf: jest.fn(() => [] as unknown[]) };
	const tagsService: Record<string, jest.Mock> = {
		getTagsByLevel: jest.fn(async () => ({ items: [] as ITag[], total: 0 })),
		create: jest.fn((input: Partial<ITag>) => of({ id: 'tag-new', ...input } as ITag))
	};
	const store = { selectedOrganization: { id: 'org', tenantId: 'tenant' } };
	/** Ownership scope (spec 08 §1.7); permissive by default so the existing cases are unaffected. */
	const documentPermission: Record<string, jest.Mock> = { canMutate: jest.fn(() => true) };

	const deps = {
		documentsService,
		toastrService,
		actions,
		documentTreeStore,
		tagsService,
		documentPermission,
		store,
		...overrides
	};

	const component = new DocsDetailPanelComponent(
		{ instant: (key: string) => key } as never,
		deps.documentsService as never,
		{ copyMarkdown: jest.fn(), downloadMarkdown: jest.fn(), print: jest.fn() } as never,
		deps.toastrService as never,
		{ open: jest.fn(() => ({ onClose: of(null) })) } as never,
		deps.actions as never,
		{ navigateByUrl: jest.fn() } as never,
		{ duplicateNoticeFor: jest.fn(() => null) } as never,
		deps.documentTreeStore as never,
		deps.tagsService as never,
		deps.documentPermission as never,
		deps.store as never
	);
	component.documentId = DOCUMENT_ID;
	return { component, ...deps };
}

describe('DocsDetailPanelComponent — metadata, location and AI suggested tags', () => {
	describe('detail read', () => {
		it('joins the creator/updater relations the metadata grid renders', () => {
			// Only the id columns live on the row; without these joins the Created/Updated
			// rows would silently degrade to a bare timestamp.
			expect(DOCS_DETAIL_RELATIONS).toEqual(
				expect.arrayContaining(['createdByUser', 'updatedByUser', 'parent'])
			);
		});
	});

	describe('userLabel', () => {
		it('prefers the full name, then first/last, then the email', () => {
			const { component } = createPanel();

			expect(component.userLabel({ name: 'Ada Lovelace' } as never)).toBe('Ada Lovelace');
			expect(component.userLabel({ firstName: 'Ada', lastName: 'Lovelace' } as never)).toBe('Ada Lovelace');
			expect(component.userLabel({ email: 'ada@example.com' } as never)).toBe('ada@example.com');
		});

		it('is empty when the relation did not come back — never a fake attribution', () => {
			const { component } = createPanel();

			expect(component.userLabel(undefined)).toBe('');
			expect(component.userLabel({} as never)).toBe('');
		});
	});

	describe('location', () => {
		it('is empty for a root-level document (only the "All documents" crumb renders)', async () => {
			const { component, documentsService } = createPanel();
			documentsService.getById = jest.fn(() => of(doc()));

			await component.reload();
			await flush();

			expect(component.location).toEqual([]);
		});

		it('uses the shared tree cache when the ancestors are already loaded', async () => {
			const { component, documentsService, documentTreeStore } = createPanel();
			documentsService.getById = jest.fn(() => of(doc({ parentId: PARENT_ID })));
			documentTreeStore.pathOf = jest.fn(() => [
				{ id: GRANDPARENT_ID, name: 'Clients' },
				{ id: PARENT_ID, name: 'Acme' }
			]);

			await component.reload();
			await flush();

			expect(component.location).toEqual([
				{ id: GRANDPARENT_ID, name: 'Clients' },
				{ id: PARENT_ID, name: 'Acme' }
			]);
		});

		it('falls back to a parent read on a cold deep link, keeping the grandparent crumb', async () => {
			const { component, documentsService } = createPanel();
			documentsService.getById = jest.fn((id: ID) =>
				id === DOCUMENT_ID
					? of(doc({ parentId: PARENT_ID }))
					: of(
							doc({
								id: PARENT_ID,
								name: 'Acme',
								parent: { id: GRANDPARENT_ID, name: 'Clients' } as IDocument
							})
					  )
			);

			await component.reload();
			await flush();

			expect(component.location).toEqual([
				{ id: GRANDPARENT_ID, name: 'Clients' },
				{ id: PARENT_ID, name: 'Acme' }
			]);
		});

		it('never breaks the panel when the ancestor read fails', async () => {
			const { component, documentsService } = createPanel();
			documentsService.getById = jest.fn((id: ID) =>
				id === DOCUMENT_ID
					? of(doc({ parentId: PARENT_ID, parent: { id: PARENT_ID, name: 'Acme' } as IDocument }))
					: throwError(() => new Error('boom'))
			);

			await component.reload();
			await flush();

			expect(component.loadError).toBe(false);
			expect(component.location).toEqual([{ id: PARENT_ID, name: 'Acme' }]);
		});
	});

	describe('ownership scoping (08 §1.7)', () => {
		// The template ANDs `canMutate` onto every `ngxPermissionsOnly` write gate, so this
		// getter is what decides whether a DOCS_UPDATE holder is offered edit/archive/delete
		// on a document they may not write.
		it('delegates to DocumentPermissionService for the open document', () => {
			const { component, documentPermission } = createPanel();
			component.document = doc();

			expect(component.canMutate).toBe(true);
			expect(documentPermission.canMutate).toHaveBeenCalledWith(component.document);

			documentPermission.canMutate = jest.fn(() => false);
			expect(component.canMutate).toBe(false);
		});
	});

	describe('suggested tags', () => {
		it('reads `metadata.ai.suggestedTags`', () => {
			const { component } = createPanel();
			component.document = doc({ metadata: { ai: { suggestedTags: ['acme-corp', 'q3-2026'] } } as never });

			expect(component.suggestedTags).toEqual(['acme-corp', 'q3-2026']);
		});

		it('🛑 parses the sqlite shape, where `metadata` is a serialized string', () => {
			const { component } = createPanel();
			component.document = doc({
				metadata: JSON.stringify({ ai: { suggestedTags: ['acme-corp'] } }) as never
			});

			expect(component.suggestedTags).toEqual(['acme-corp']);
		});

		it('hides a suggestion that is already applied (case-insensitively) and de-duplicates', () => {
			const { component } = createPanel();
			component.document = doc({
				tags: [{ id: 't1', name: 'Acme-Corp' } as ITag],
				metadata: { ai: { suggestedTags: ['acme-corp', 'q3-2026', 'q3-2026', ' '] } } as never
			});

			expect(component.suggestedTags).toEqual(['q3-2026']);
		});

		it('survives a document with no metadata at all', () => {
			const { component } = createPanel();
			component.document = doc();

			expect(component.suggestedTags).toEqual([]);
		});

		it('reuses an existing organization tag instead of minting a near-duplicate', async () => {
			const { component, tagsService, documentsService } = createPanel();
			component.document = doc({ metadata: { ai: { suggestedTags: ['acme-corp'] } } as never });
			tagsService.getTagsByLevel = jest.fn(async () => ({
				items: [{ id: 'tag-existing', name: 'Acme-Corp' } as ITag],
				total: 1
			}));

			await component.acceptSuggestedTag('acme-corp');

			expect(tagsService.create).not.toHaveBeenCalled();
			expect(documentsService.update).toHaveBeenCalledWith(DOCUMENT_ID, { tagIds: ['tag-existing'] });
		});

		it('creates the tag only when the catalog has no match', async () => {
			const { component, tagsService, documentsService } = createPanel();
			component.document = doc({ metadata: { ai: { suggestedTags: ['q3-2026'] } } as never });

			await component.acceptSuggestedTag('q3-2026');

			expect(tagsService.create).toHaveBeenCalledWith(
				expect.objectContaining({ name: 'q3-2026', organizationId: 'org', tenantId: 'tenant' })
			);
			expect(documentsService.update).toHaveBeenCalledWith(DOCUMENT_ID, { tagIds: ['tag-new'] });
		});

		it('drops the chip once the tag is on the document', async () => {
			const { component } = createPanel();
			component.document = doc({ metadata: { ai: { suggestedTags: ['q3-2026'] } } as never });

			await component.acceptSuggestedTag('q3-2026');

			expect(component.suggestedTags).toEqual([]);
			expect(component.acceptingTag).toBeNull();
		});

		it('keeps the chip and reports the failure when the write is rejected', async () => {
			const { component, documentsService, toastrService } = createPanel();
			component.document = doc({ metadata: { ai: { suggestedTags: ['q3-2026'] } } as never });
			documentsService.update = jest.fn(() => throwError(() => new Error('boom')));

			await component.acceptSuggestedTag('q3-2026');

			expect(toastrService.danger).toHaveBeenCalled();
			expect(component.suggestedTags).toEqual(['q3-2026']);
			expect(component.acceptingTag).toBeNull();
		});
	});

	describe('tag writes', () => {
		it('🛑 sends `tagIds`, not `tags` — the DTO whitelists ids and forbids the rest', async () => {
			const { component, documentsService } = createPanel();
			component.document = doc();

			await component.onTagsChange([{ id: 't1', name: 'Contract' } as ITag]);

			// `PUT /documents/:id` runs with `forbidNonWhitelisted: true`, so an `ITag[]` body
			// is a 400 rather than a silently ignored field.
			expect(documentsService.update).toHaveBeenCalledWith(DOCUMENT_ID, { tagIds: ['t1'] });
		});

		it('sends an empty id list when every tag is removed', async () => {
			const { component, documentsService } = createPanel();
			component.document = doc();

			await component.onTagsChange([]);

			expect(documentsService.update).toHaveBeenCalledWith(DOCUMENT_ID, { tagIds: [] });
		});
	});
});
