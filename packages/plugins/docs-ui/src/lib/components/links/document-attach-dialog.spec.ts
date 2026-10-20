/**
 * Same stubs as the panel spec: the `@gauzy/ui-core` barrels pull Akita's untranspiled
 * ESM into the CommonJS test runtime, and the dialog only needs the base class and
 * the Store's organization. Constructed directly — no `TestBed`.
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

import { of, throwError } from 'rxjs';
import { BaseEntityEnum, DocumentKindEnum, ID, IDocument, IDocumentLink } from '@gauzy/contracts';
import { DocumentAttachDialogComponent } from './document-attach-dialog.component';

const ENTITY_ID = 'dddddddd-1111-4111-8111-111111111111' as ID;

const doc = (id: string, name = `${id}.pdf`): IDocument => ({ id, name, kind: DocumentKindEnum.FILE }) as IDocument;

function createDialog(createLink: jest.Mock) {
	const dialogRef = { close: jest.fn() };
	const toastrService = { success: jest.fn(), danger: jest.fn() };
	const dialog = new DocumentAttachDialogComponent(
		{ instant: (key: string) => key } as never,
		dialogRef as never,
		{ createLink } as never,
		toastrService as never,
		{ selectedOrganization: { id: 'org', tenantId: 'tenant' } } as never
	);
	dialog.entity = BaseEntityEnum.OrganizationProject;
	dialog.entityId = ENTITY_ID;
	dialog.results = [doc('a'), doc('b'), doc('c')];
	return { dialog, dialogRef, toastrService };
}

describe('DocumentAttachDialogComponent — attaching several documents at once', () => {
	it('toggles documents in and out of the selection', () => {
		const { dialog } = createDialog(jest.fn());

		dialog.toggle(doc('a'));
		dialog.toggle(doc('b'));
		dialog.toggle(doc('a'));

		expect(dialog.selectedCount).toBe(1);
		expect(dialog.isSelected(doc('b'))).toBe(true);
		expect(dialog.canConfirm).toBe(true);
	});

	it('links every selected document and closes with the links made', async () => {
		const createLink = jest.fn(({ documentId }) => of({ id: `link-${documentId}`, documentId } as IDocumentLink));
		const { dialog, dialogRef, toastrService } = createDialog(createLink);
		dialog.toggle(doc('a'));
		dialog.toggle(doc('c'));

		await dialog.confirm();

		expect(createLink).toHaveBeenCalledTimes(2);
		expect(createLink).toHaveBeenCalledWith(
			expect.objectContaining({ documentId: 'c', entity: BaseEntityEnum.OrganizationProject, entityId: ENTITY_ID })
		);
		expect(toastrService.success).toHaveBeenCalledWith('DOCS.LINKS.TOAST_ADDED_MANY');
		expect(dialogRef.close).toHaveBeenCalledWith([
			expect.objectContaining({ documentId: 'a' }),
			expect.objectContaining({ documentId: 'c' })
		]);
	});

	it('keeps the links that worked and reports the ones that did not', async () => {
		const createLink = jest.fn(({ documentId }) =>
			documentId === 'b' ? throwError(() => new Error('forbidden')) : of({ id: 'link-a', documentId } as IDocumentLink)
		);
		const { dialog, dialogRef, toastrService } = createDialog(createLink);
		dialog.toggle(doc('a'));
		dialog.toggle(doc('b'));

		await dialog.confirm();

		expect(toastrService.success).toHaveBeenCalledWith('DOCS.LINKS.TOAST_ADDED');
		expect(toastrService.danger).toHaveBeenCalledWith('DOCS.LINKS.TOAST_FAILED_SOME');
		expect(dialogRef.close).toHaveBeenCalledWith([expect.objectContaining({ documentId: 'a' })]);
	});

	it('stays open when nothing could be attached, so the user can retry', async () => {
		const error = new Error('forbidden');
		const { dialog, dialogRef, toastrService } = createDialog(jest.fn(() => throwError(() => error)));
		dialog.toggle(doc('a'));

		await dialog.confirm();

		// A single document keeps the server's own reason.
		expect(toastrService.danger).toHaveBeenCalledWith(error);
		expect(dialogRef.close).not.toHaveBeenCalled();
		expect(dialog.saving).toBe(false);
	});
});
