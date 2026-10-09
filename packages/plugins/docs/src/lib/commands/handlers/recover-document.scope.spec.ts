/**
 * Regression cover for `POST /documents/:id/recover`.
 *
 * The handler used to hand a bare `(id, tenantId)` pair to `DocumentTreeService`, whose lookup
 * was tenant-scoped only — so any soft-deleted document in the tenant could be un-deleted and
 * returned, across organizations and regardless of visibility. The scoped, soft-delete-aware
 * lookup now happens in the handler, and the resolved entity is what the tree service acts on.
 */
jest.mock('../../services/document.service', () => ({ DocumentService: class {} }));
jest.mock('../../services/document-tree.service', () => ({ DocumentTreeService: class {} }));

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RecoverDocumentCommand } from '../recover-document.command';
import { RecoverDocumentHandler } from './recover-document.handler';

const buildHandler = (options: { found?: any; writable?: boolean } = {}) => {
	const documentService: any = {
		findOneDeletedScoped: jest.fn(async () => {
			if (options.found === null) {
				throw new NotFoundException('Document was not found');
			}
			return options.found ?? { id: 'doc-1', organizationId: 'org-1', deletedAt: new Date() };
		}),
		findOneScoped: jest.fn(),
		assertCanWrite: jest.fn(async () => {
			if (options.writable === false) {
				throw new ForbiddenException('no write');
			}
		}),
		emitDocumentEvent: jest.fn()
	};
	const treeService: any = { recoverDocument: jest.fn(async (document: any) => document) };
	return { handler: new RecoverDocumentHandler(documentService, treeService), documentService, treeService };
};

describe('RecoverDocumentHandler — scope', () => {
	it('resolves the trashed row through the scoped soft-delete lookup', async () => {
		const { handler, documentService, treeService } = buildHandler();

		await handler.execute(new RecoverDocumentCommand('doc-1'));

		expect(documentService.findOneDeletedScoped).toHaveBeenCalledWith('doc-1');
		// The tree service acts on the already-authorized entity, never on a raw id.
		expect(treeService.recoverDocument).toHaveBeenCalledWith(expect.objectContaining({ id: 'doc-1' }));
	});

	it('404s an id outside the caller scope without un-deleting anything', async () => {
		const { handler, treeService } = buildHandler({ found: null });

		await expect(handler.execute(new RecoverDocumentCommand('doc-1'))).rejects.toBeInstanceOf(NotFoundException);
		expect(treeService.recoverDocument).not.toHaveBeenCalled();
	});

	it('403s a caller who may read the trashed row but not write it', async () => {
		const { handler, treeService } = buildHandler({ writable: false });

		await expect(handler.execute(new RecoverDocumentCommand('doc-1'))).rejects.toBeInstanceOf(ForbiddenException);
		expect(treeService.recoverDocument).not.toHaveBeenCalled();
	});
});
