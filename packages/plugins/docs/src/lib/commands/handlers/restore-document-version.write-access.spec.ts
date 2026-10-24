/**
 * Restoring a version rewrote a page's name and content after a READ check only (`findOneScoped`): any holder of
 * DOCS_UPDATE who could read a page — a colleague's ORGANIZATION page, which only its owner or a DOCS_MANAGE holder
 * may write, or a PRIVATE page shared with them at VIEW or COMMENT — could overwrite it with any of its versions.
 * Every other content mutation asserts write access; the restore now does too.
 */
jest.mock('../../services/document.service', () => ({ DocumentService: class {} }));
jest.mock('../../services/document-version.service', () => ({ DocumentVersionService: class {} }));

import { ForbiddenException } from '@nestjs/common';
import { RestoreDocumentVersionCommand } from '../restore-document-version.command';
import { RestoreDocumentVersionHandler } from './restore-document-version.handler';

describe('RestoreDocumentVersionHandler — a restore needs write access', () => {
	const page = { id: 'page-1', name: 'Roadmap' };

	const build = (canWrite: boolean) => {
		const documentService = {
			findOneScoped: jest.fn(async () => page),
			assertCanWrite: jest.fn(async () => {
				if (!canWrite) {
					throw new ForbiddenException('You do not have write access to this document');
				}
			}),
			emitDocumentEvent: jest.fn()
		};
		const documentVersionService = { restoreVersion: jest.fn(async () => ({ ...page, name: 'Restored' })) };
		const handler = new RestoreDocumentVersionHandler(documentService as any, documentVersionService as any);
		return { handler, documentService, documentVersionService };
	};

	it('refuses a reader who may not write the page, and restores nothing', async () => {
		const { handler, documentVersionService, documentService } = build(false);

		await expect(handler.execute(new RestoreDocumentVersionCommand('page-1', 'version-1'))).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(documentService.assertCanWrite).toHaveBeenCalledWith(page);
		expect(documentVersionService.restoreVersion).not.toHaveBeenCalled();
	});

	it('restores for a caller who may write the page (control)', async () => {
		const { handler, documentVersionService } = build(true);

		await expect(handler.execute(new RestoreDocumentVersionCommand('page-1', 'version-1'))).resolves.toMatchObject({
			name: 'Restored'
		});
		expect(documentVersionService.restoreVersion).toHaveBeenCalledWith(page, 'version-1');
	});
});
