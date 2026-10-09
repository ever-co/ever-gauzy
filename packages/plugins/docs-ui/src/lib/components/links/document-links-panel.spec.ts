/**
 * `@gauzy/ui-core/i18n` and `@gauzy/ui-core/core` are barrels over the whole app:
 * importing them pulls Akita's untranspiled ESM into the CommonJS test runtime.
 * The panel only needs `TranslationBaseComponent` to exist and `Store` to answer
 * permission/feature questions, so both are stubbed and the component is
 * constructed directly — no `TestBed`.
 */
jest.mock('@gauzy/ui-core/i18n', () => ({
	TranslationBaseComponent: class {
		constructor(public readonly translateService: unknown) {}
		getTranslation(key: string): string {
			return key;
		}
	}
}));
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {}, ToastrService: class ToastrService {} }));

import { HttpEventType, HttpResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { BaseEntityEnum, DocumentKindEnum, ID, IDocument, IDocumentLink, PermissionsEnum } from '@gauzy/contracts';
import { DocumentLinksPanelComponent } from './document-links-panel.component';

const ENTITY_ID = 'cccccccc-1111-4111-8111-111111111111' as ID;
const OTHER_ENTITY_ID = 'cccccccc-1111-4111-8111-222222222222' as ID;
const PAGE_ID = 'cccccccc-2222-4222-8222-111111111111' as ID;
const FILE_ID = 'cccccccc-2222-4222-8222-222222222222' as ID;
const LINK_ID = 'cccccccc-3333-4333-8333-111111111111' as ID;

function pageLink(overrides: Partial<IDocumentLink> = {}): IDocumentLink {
	return {
		id: LINK_ID,
		documentId: PAGE_ID,
		entity: BaseEntityEnum.Invoice,
		entityId: ENTITY_ID,
		document: { id: PAGE_ID, name: 'Terms', kind: DocumentKindEnum.PAGE } as IDocument,
		...overrides
	} as IDocumentLink;
}

function fileLink(overrides: Partial<IDocumentLink> = {}): IDocumentLink {
	return {
		id: LINK_ID,
		documentId: FILE_ID,
		entity: BaseEntityEnum.Invoice,
		entityId: ENTITY_ID,
		document: {
			id: FILE_ID,
			name: 'invoice.pdf',
			kind: DocumentKindEnum.FILE,
			fileSize: 2048
		} as IDocument,
		...overrides
	} as IDocumentLink;
}

/**
 * Builds the panel with per-test doubles. Everything is a plain object — the
 * component has no Angular lifecycle beyond `ngOnChanges`.
 */
function createPanel(
	overrides: {
		links?: Observable<IDocumentLink[]>;
		permissions?: PermissionsEnum[];
		featureEnabled?: boolean;
		upload?: Observable<unknown>;
	} = {}
) {
	const granted = overrides.permissions ?? [
		PermissionsEnum.DOCS_READ,
		PermissionsEnum.DOCS_CREATE,
		PermissionsEnum.DOCS_UPDATE
	];

	const documentsService = {
		findLinks: jest.fn(() => overrides.links ?? of([])),
		createLink: jest.fn(() => of({ id: LINK_ID } as IDocumentLink)),
		deleteLink: jest.fn(() => of(undefined)),
		getDownloadUrl: jest.fn(() => of('https://files.example/signed/invoice.pdf')),
		upload: jest.fn(() => overrides.upload ?? of())
	};
	const dialogService = { open: jest.fn(() => ({ onClose: of(null) })) };
	const toastrService = { success: jest.fn(), danger: jest.fn() };
	const router = { navigate: jest.fn(async () => true) };
	const store = {
		selectedOrganization: { id: 'org', tenantId: 'tenant' },
		hasPermission: (permission: PermissionsEnum) => granted.includes(permission),
		hasFeatureEnabled: () => overrides.featureEnabled ?? true
	};

	const panel = new DocumentLinksPanelComponent(
		{ instant: (key: string) => key } as never,
		documentsService as never,
		dialogService as never,
		toastrService as never,
		router as never,
		store as never
	);
	panel.entity = BaseEntityEnum.Invoice;
	panel.entityId = ENTITY_ID;

	return { panel, documentsService, dialogService, toastrService, router, store };
}

describe('DocumentLinksPanelComponent — record-side Documents panel (spec 00 §6.14 R-LNK-02)', () => {
	describe('self-gating', () => {
		it('is invisible without DOCS_READ, and never asks the API', async () => {
			const { panel, documentsService } = createPanel({ permissions: [] });

			expect(panel.visible).toBe(false);
			await panel.load();

			expect(documentsService.findLinks).not.toHaveBeenCalled();
			expect(panel.links).toEqual([]);
		});

		it('is invisible when FEATURE_DOCUMENTS is off for the organization', () => {
			// The permission alone is not enough: `FeatureFlagGuard` fronts every docs
			// route, so the panel would render and then 403 on its own first request.
			const { panel } = createPanel({ featureEnabled: false });

			expect(panel.visible).toBe(false);
		});

		it('is invisible until the host has bound a record id', () => {
			const { panel } = createPanel();
			panel.entityId = undefined as never;

			expect(panel.visible).toBe(false);
		});

		it('offers "upload new" only with BOTH DOCS_CREATE and DOCS_UPDATE', () => {
			// Upload is a document write followed by a link write — a DOCS_CREATE-only
			// holder would upload the file and then fail to attach it.
			expect(
				createPanel({ permissions: [PermissionsEnum.DOCS_READ, PermissionsEnum.DOCS_CREATE] }).panel.canUpload
			).toBe(false);
			expect(
				createPanel({ permissions: [PermissionsEnum.DOCS_READ, PermissionsEnum.DOCS_UPDATE] }).panel.canUpload
			).toBe(false);
			expect(createPanel().panel.canUpload).toBe(true);
		});
	});

	describe('read-only + hide-when-empty hosting (invoice/estimate view page)', () => {
		it('defaults both inputs off — the existing hosts keep the full, always-present panel', () => {
			const { panel } = createPanel();

			expect(panel.readonly).toBe(false);
			expect(panel.hideWhenEmpty).toBe(false);
			// Zero links, hideWhenEmpty off → the card still renders (so "attach" is offered).
			expect(panel.shown).toBe(true);
		});

		it('with hideWhenEmpty the card stays hidden at zero links and appears once links load', async () => {
			const { panel } = createPanel({ links: of([fileLink()]) });
			panel.hideWhenEmpty = true;

			expect(panel.shown).toBe(false);
			await panel.load();
			expect(panel.shown).toBe(true);

			// …and goes away again with the last link.
			await panel.unlink(panel.links[0]);
			expect(panel.shown).toBe(false);
		});

		it('with hideWhenEmpty a FAILED load keeps the card up — the error and retry must stay reachable', async () => {
			// `load()` clears `links` on failure; gating on links alone would hide the
			// panel exactly when it has something to say (the error + retry button).
			const { panel } = createPanel({ links: throwError(() => new Error('boom')) });
			panel.hideWhenEmpty = true;

			await panel.load();

			expect(panel.loadError).toBe(true);
			expect(panel.links).toEqual([]);
			expect(panel.shown).toBe(true);
		});

		it('with hideWhenEmpty a load in flight keeps the card up (spinner host)', () => {
			const { panel } = createPanel();
			panel.hideWhenEmpty = true;
			panel.loading = true;

			expect(panel.shown).toBe(true);
		});

		it('hideWhenEmpty never overrides the DOCS_READ / feature gate', async () => {
			const { panel } = createPanel({ permissions: [], links: of([fileLink()]) });
			panel.hideWhenEmpty = true;
			await panel.load();

			expect(panel.shown).toBe(false);
		});

		it('readonly keeps the panel shown and the permissions intact — only the template affordances go', () => {
			// The template gates attach/upload/unlink on `!readonly && can*`, so a
			// readonly host drops the write affordances while open/download stay.
			// `readonly` is a host choice, not a permission: `canLink`/`canUpload`
			// must not flip, or a later non-readonly rebind would mis-render.
			const { panel } = createPanel();
			panel.readonly = true;

			expect(panel.shown).toBe(true);
			expect(panel.canLink).toBe(true);
			expect(panel.canUpload).toBe(true);
		});
	});

	describe('loading', () => {
		it('queries the links of the bound record and reports the count', async () => {
			const { panel, documentsService } = createPanel({ links: of([fileLink()]) });
			const counts: number[] = [];
			panel.countChanged.subscribe((count) => counts.push(count));

			await panel.load();

			expect(documentsService.findLinks).toHaveBeenCalledWith(BaseEntityEnum.Invoice, ENTITY_ID);
			expect(panel.links).toHaveLength(1);
			expect(counts).toEqual([1]);
		});

		it('reloads when the host rebinds another record', async () => {
			// The hosts reuse one instance across records (a routed detail page, a
			// reopened dialog) — binding once would show the previous record's files.
			const { panel, documentsService } = createPanel();

			panel.ngOnChanges({ entityId: { currentValue: ENTITY_ID } as never });
			panel.entityId = OTHER_ENTITY_ID;
			panel.ngOnChanges({ entityId: { currentValue: OTHER_ENTITY_ID } as never });
			await Promise.resolve();

			expect(documentsService.findLinks).toHaveBeenCalledTimes(2);
			expect(documentsService.findLinks).toHaveBeenLastCalledWith(BaseEntityEnum.Invoice, OTHER_ENTITY_ID);
		});

		it('is fault-isolated — a failing panel must not take the host record page down', async () => {
			const { panel } = createPanel({ links: throwError(() => new Error('boom')) });

			await panel.load();

			expect(panel.loadError).toBe(true);
			expect(panel.links).toEqual([]);
			expect(panel.loading).toBe(false);
		});
	});

	describe('row actions', () => {
		it('opens a PAGE in the editor route and a FILE through the hub deep link', () => {
			const { panel, router } = createPanel();

			panel.open(pageLink());
			expect(router.navigate).toHaveBeenLastCalledWith(['/pages/documents/page', PAGE_ID]);

			panel.open(fileLink());
			// `?id=` is what opens the detail panel (docs-shell reads the query param).
			expect(router.navigate).toHaveBeenLastCalledWith(['/pages/documents'], { queryParams: { id: FILE_ID } });
		});

		it('resolves the signed URL through the authenticated client before opening it', async () => {
			// 🛑 `/:id/download` answers `{ url }` as JSON behind the JWT guard — handing
			// the endpoint itself to the browser sends no token and lands on a 401.
			const open = jest.spyOn(window, 'open').mockImplementation(() => null);
			const { panel, documentsService } = createPanel();

			await panel.download(fileLink());

			expect(documentsService.getDownloadUrl).toHaveBeenCalledWith(FILE_ID);
			expect(open).toHaveBeenCalledWith('https://files.example/signed/invoice.pdf', '_blank', 'noopener');
			open.mockRestore();
		});

		it('drops the row and re-reports the count on unlink', async () => {
			const { panel, documentsService } = createPanel({ links: of([fileLink()]) });
			await panel.load();
			const counts: number[] = [];
			panel.countChanged.subscribe((count) => counts.push(count));

			await panel.unlink(panel.links[0]);

			expect(documentsService.deleteLink).toHaveBeenCalledWith(LINK_ID);
			expect(panel.links).toEqual([]);
			expect(counts).toEqual([0]);
		});

		it('shows the size only for a document that has bytes', () => {
			const { panel } = createPanel();

			expect(panel.sizeOf(fileLink())).toBe('2.0 KB');
			expect(panel.sizeOf(pageLink())).toBe('');
		});
	});

	describe('upload + link', () => {
		it('waits for the Response event before linking — the first emission is `Sent`', async () => {
			// The regression this pins: `firstValueFrom(upload(...))` resolves on the
			// progress stream's FIRST event, which carries no document at all.
			const uploaded = { id: FILE_ID, name: 'invoice.pdf' } as IDocument;
			const { panel, documentsService } = createPanel({
				upload: of(
					{ type: HttpEventType.Sent },
					{ type: HttpEventType.UploadProgress, loaded: 10, total: 20 },
					new HttpResponse({ body: uploaded })
				)
			});

			const input = { files: [new File(['x'], 'invoice.pdf')], value: 'invoice.pdf' } as unknown as HTMLInputElement;
			await panel.uploadNew(input);

			expect(documentsService.createLink).toHaveBeenCalledWith(
				expect.objectContaining({
					documentId: FILE_ID,
					entity: BaseEntityEnum.Invoice,
					entityId: ENTITY_ID
				})
			);
			// The input is cleared so re-picking the same file still fires `change`.
			expect(input.value).toBe('');
		});

		it('does nothing when no file was picked', async () => {
			const { panel, documentsService } = createPanel();

			await panel.uploadNew({ files: [], value: '' } as unknown as HTMLInputElement);

			expect(documentsService.upload).not.toHaveBeenCalled();
		});
	});
});
