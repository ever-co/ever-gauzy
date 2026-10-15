import { DocumentKindEnum } from '@gauzy/contracts';
import { documentViewRedirect } from './document-file-view';

/**
 * `/pages/documents/file/:id` opens one document on its own, full width (owner, 2026-10-15: a favorite
 * "should display document full width, not display a list of documents"). A favorite whose kind was not known
 * when its link was built lands here too, so the page forwards a PAGE to the page editor and a FOLDER to that
 * folder, and shows everything else itself.
 */
describe('documentViewRedirect', () => {
	const ID = 'dddddddd-1111-4111-8111-111111111111';

	it('forwards a page to the page editor at full width', () => {
		expect(documentViewRedirect({ id: ID, kind: DocumentKindEnum.PAGE })).toEqual({
			commands: ['/pages/documents/page', ID],
			queryParams: { view: 'full' }
		});
	});

	it('forwards a folder to that folder in the documents hub', () => {
		expect(documentViewRedirect({ id: ID, kind: DocumentKindEnum.FOLDER })).toEqual({
			commands: ['/pages/documents'],
			queryParams: { folder: ID }
		});
	});

	it('shows an uploaded file itself', () => {
		expect(documentViewRedirect({ id: ID, kind: DocumentKindEnum.FILE })).toBeNull();
	});

	it('shows a document of any other kind itself, rather than sending it to the list', () => {
		expect(documentViewRedirect({ id: ID, kind: undefined })).toBeNull();
	});
});
