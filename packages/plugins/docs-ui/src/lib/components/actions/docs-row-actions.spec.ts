/**
 * `@gauzy/ui-core/core` is a barrel over the whole app core — importing it pulls
 * Akita's untranspiled ESM into the CommonJS test runtime. Only the injected
 * shapes matter here, so stubs stand in for the classes.
 */
jest.mock('@gauzy/ui-core/core', () => ({
	Store: class Store {},
	ToastrService: class ToastrService {},
	FavoriteStoreService: class FavoriteStoreService {},
	GenericFavoriteService: class GenericFavoriteService {}
}));

import { of, Subject } from 'rxjs';
import { DocumentKindEnum, ID, IDocument } from '@gauzy/contracts';
import { DocsDeleteDialogComponent } from '../../dialogs/delete-dialog.component';
import { DocsRowActionsService } from './docs-row-actions.service';
import { IDocsActionTarget } from './docs-action-menu';

const DOCUMENT_ID = 'aaaaaaaa-1111-4111-8111-111111111111' as ID;
const OTHER_ID = 'aaaaaaaa-2222-4222-8222-222222222222' as ID;

const translateStub = { instant: (key: string) => key, onLangChange: new Subject() };

function target(overrides: Partial<IDocsActionTarget> = {}): IDocsActionTarget {
	return { id: DOCUMENT_ID, kind: DocumentKindEnum.FILE, name: 'invoice.pdf', ...overrides };
}

/**
 * Builds the service with per-test doubles. Everything is a plain object: the
 * class has no Angular lifecycle beyond the favorites subscription its
 * constructor opens.
 */
function createService(overrides: Record<string, unknown> = {}) {
	const documentsService = {
		getDownloadUrl: jest.fn(() => of('https://files.example/signed/invoice.pdf')),
		delete: jest.fn(() => of(undefined)),
		duplicate: jest.fn(() => of({ id: OTHER_ID } as IDocument)),
		archive: jest.fn(() => of({ id: DOCUMENT_ID } as IDocument)),
		unarchive: jest.fn(() => of({ id: DOCUMENT_ID } as IDocument)),
		knowledgeImport: jest.fn(() => of({ id: DOCUMENT_ID } as IDocument)),
		knowledgeExclude: jest.fn(() => of({ id: DOCUMENT_ID } as IDocument))
	};
	const dialogService = { open: jest.fn(() => ({ onClose: of(null) })) };
	const toastrService = { success: jest.fn(), danger: jest.fn(), warning: jest.fn(), info: jest.fn() };
	const actions = { dispatch: jest.fn() };
	const treeStore = { invalidate: jest.fn(), invalidateAll: jest.fn() };
	const exportService = { downloadMarkdown: jest.fn(async () => true) };
	const router = { navigate: jest.fn(async () => true) };
	const favoriteStore = { favoriteItems$: of([]) };
	const genericFavoriteService = { loadFavorites: jest.fn(async () => []), toggleFavorite: jest.fn(async () => undefined) };
	const store = { selectedOrganization: { id: 'org', tenantId: 'tenant' }, user: { employee: { id: 'emp' } } };

	const deps = {
		documentsService,
		dialogService,
		toastrService,
		actions,
		treeStore,
		exportService,
		router,
		favoriteStore,
		genericFavoriteService,
		store,
		...overrides
	};

	const service = new DocsRowActionsService(
		translateStub as never,
		deps.documentsService as never,
		deps.exportService as never,
		deps.treeStore as never,
		deps.dialogService as never,
		deps.toastrService as never,
		deps.actions as never,
		deps.router as never,
		deps.favoriteStore as never,
		deps.genericFavoriteService as never,
		deps.store as never
	);
	return { service, ...deps };
}

describe('DocsRowActionsService — download', () => {
	let open: jest.SpyInstance;

	beforeEach(() => {
		open = jest.spyOn(window, 'open').mockImplementation(() => null);
	});

	afterEach(() => open.mockRestore());

	// The route is a JWT-guarded JSON endpoint, not a redirect: navigating to it
	// sends no bearer token and lands on a 401.
	it('resolves the signed URL through the authenticated client, then opens THAT', async () => {
		const { service, documentsService } = createService();

		await service.execute('download', target());

		expect(documentsService.getDownloadUrl).toHaveBeenCalledWith(DOCUMENT_ID);
		expect(open).toHaveBeenCalledWith('https://files.example/signed/invoice.pdf', '_blank', 'noopener');
	});

	it('never opens the API route itself', async () => {
		const { service } = createService();

		await service.execute('download', target());

		expect(open).not.toHaveBeenCalledWith(expect.stringContaining('/download'), expect.anything(), expect.anything());
	});

	it('opens nothing when the endpoint answers an empty url', async () => {
		const { service } = createService({
			documentsService: { getDownloadUrl: jest.fn(() => of('')) }
		});

		await service.execute('download', target());

		expect(open).not.toHaveBeenCalled();
	});
});

describe('DocsRowActionsService — delete', () => {
	it('forwards the strategy the prompt returned', async () => {
		const { service, documentsService, dialogService } = createService({
			dialogService: { open: jest.fn(() => ({ onClose: of({ strategy: 'promote-children' }) })) }
		});

		await service.execute('delete', target({ kind: DocumentKindEnum.FOLDER, isArchived: true }));

		expect(dialogService.open).toHaveBeenCalledWith(DocsDeleteDialogComponent, expect.anything());
		expect(documentsService.delete).toHaveBeenCalledWith(DOCUMENT_ID, { strategy: 'promote-children' });
	});

	it('deletes nothing when the prompt is cancelled', async () => {
		const { service, documentsService } = createService();

		await expect(service.execute('delete', target({ isArchived: true }))).resolves.toBe(false);
		expect(documentsService.delete).not.toHaveBeenCalled();
	});

	it('drops the row and re-counts the facets once the delete lands', async () => {
		const { service, actions } = createService({
			dialogService: { open: jest.fn(() => ({ onClose: of({ strategy: 'subtree' }) })) }
		});

		await service.execute('delete', target({ isArchived: true }));

		const dispatched = actions.dispatch.mock.calls.map(([action]) => (action as { type: string }).type);
		expect(dispatched).toEqual(expect.arrayContaining(['[Docs] Row Removed', '[Docs] Refresh Facets']));
	});
});

describe('DocsRowActionsService — duplicate', () => {
	it.each([
		['duplicate', false],
		['duplicate-deep', true]
	] as const)('sends `deep: %s` for %s', async (action, deep) => {
		const { service, documentsService } = createService();

		await service.execute(action, target({ kind: DocumentKindEnum.FOLDER }));

		expect(documentsService.duplicate).toHaveBeenCalledWith(DOCUMENT_ID, { deep });
	});
});

describe('DocsRowActionsService — favorites', () => {
	it('reads the starred ids out of the shared favorites store', () => {
		const { service } = createService({
			favoriteStore: {
				favoriteItems$: of([
					{ link: `/pages/documents?id=${DOCUMENT_ID}` },
					{ link: '/pages/employees/edit/123' },
					{ link: undefined }
				])
			}
		});

		expect(service.isFavorite(DOCUMENT_ID)).toBe(true);
		expect(service.isFavorite(OTHER_ID)).toBe(false);
	});

	it('links a PAGE to its editor route and everything else to the detail panel', () => {
		const { service } = createService();

		expect(service.deepLink(target({ kind: DocumentKindEnum.PAGE }))).toContain(`/pages/documents/page/${DOCUMENT_ID}`);
		expect(service.deepLink(target({ kind: DocumentKindEnum.FILE }))).toContain(`/pages/documents?id=${DOCUMENT_ID}`);
	});
});

describe('DocsRowActionsService — failure handling', () => {
	// Every caller is a menu-click subscription that cannot await the promise, so a
	// rejection escaping here would be an unhandled one.
	it('never rejects — a failing call surfaces as a toast', async () => {
		const { service, toastrService } = createService({
			documentsService: {
				duplicate: jest.fn(() => {
					throw new Error('boom');
				})
			}
		});

		await expect(service.execute('duplicate', target())).resolves.toBe(false);
		expect(toastrService.danger).toHaveBeenCalled();
	});

	it('ignores the view actions, which belong to the calling surface', async () => {
		const { service, documentsService, dialogService } = createService();

		for (const action of ['open', 'details', 'preview'] as const) {
			await expect(service.execute(action, target())).resolves.toBe(false);
		}
		expect(dialogService.open).not.toHaveBeenCalled();
		expect(documentsService.archive).not.toHaveBeenCalled();
	});
});

describe('DocsDeleteDialogComponent — subtree prompt (01-ux-spec §10.11)', () => {
	function createDialog(overrides: { total?: number; target?: Partial<IDocsActionTarget> } = {}) {
		const dialogRef = { close: jest.fn() };
		const documentsService = { getAll: jest.fn(() => of({ items: [], total: overrides.total ?? 0 })) };
		const component = new DocsDeleteDialogComponent(
			translateStub as never,
			dialogRef as never,
			documentsService as never
		);
		component.target = { id: DOCUMENT_ID, kind: DocumentKindEnum.FOLDER, name: 'Finance', ...overrides.target };
		return { component, dialogRef, documentsService };
	}

	it('offers the choice only when the node actually has children', async () => {
		const withChildren = createDialog({ total: 4 });
		const empty = createDialog({ total: 0 });

		withChildren.component.ngOnInit();
		empty.component.ngOnInit();
		await Promise.resolve();

		expect(withChildren.component.hasChildren).toBe(true);
		expect(empty.component.hasChildren).toBe(false);
	});

	it('trusts a caller-supplied childrenCount instead of spending a request', () => {
		const { component, documentsService } = createDialog({ target: { childrenCount: 2 } });

		component.ngOnInit();

		expect(component.hasChildren).toBe(true);
		expect(documentsService.getAll).not.toHaveBeenCalled();
	});

	it('never costs a request for a FILE — it is a leaf by construction', () => {
		const { component, documentsService } = createDialog({ target: { kind: DocumentKindEnum.FILE } });

		component.ngOnInit();

		expect(component.hasChildren).toBe(false);
		expect(documentsService.getAll).not.toHaveBeenCalled();
	});

	it('closes with the selected strategy', async () => {
		const { component, dialogRef } = createDialog({ total: 3 });
		component.ngOnInit();
		await Promise.resolve();

		component.strategy = 'promote-children';
		component.confirm();

		expect(dialogRef.close).toHaveBeenCalledWith({ strategy: 'promote-children' });
	});

	// A leaf has nothing to promote; sending a strategy the user was never offered
	// is how the old hardcoded `promote-children` misrepresented what would happen.
	it('closes with `subtree` when there were no children to decide about', () => {
		const { component, dialogRef } = createDialog({ target: { kind: DocumentKindEnum.FILE } });
		component.ngOnInit();

		component.strategy = 'promote-children';
		component.confirm();

		expect(dialogRef.close).toHaveBeenCalledWith({ strategy: 'subtree' });
	});

	it('closes with null on cancel', () => {
		const { component, dialogRef } = createDialog();

		component.cancel();

		expect(dialogRef.close).toHaveBeenCalledWith(null);
	});
});
