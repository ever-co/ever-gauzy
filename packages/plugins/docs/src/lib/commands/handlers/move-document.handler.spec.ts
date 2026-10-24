/**
 * `POST /plugins/docs/documents/:id/move` reads its target parent the way a create reads its parent, and needs write
 * access to it, as a duplicate's target does.
 *
 * The tree's own parent lookup checks only the organization, so a writer could move a document into another
 * member's PRIVATE folder by its id (and learn from the answer that the folder exists). Reading it was not enough
 * either: a VIEW/COMMENT grantee of such a folder could file their documents into it, renumbering its children.
 */
jest.mock('../../services/document.service', () => ({ DocumentService: class {} }));
jest.mock('../../services/document-tree.service', () => ({ DocumentTreeService: class {} }));

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MoveDocumentCommand } from '../move-document.command';
import { MoveDocumentHandler } from './move-document.handler';

const buildHandler = (unreadable: string[] = [], readOnly: string[] = []) => {
	const documentService: any = {
		findOneScoped: jest.fn(async (id: string) => {
			if (unreadable.includes(id)) {
				throw new NotFoundException('Document was not found');
			}
			return { id, organizationId: 'org-1', parentId: null };
		}),
		assertCanWrite: jest.fn(async (document: { id: string }) => {
			if (readOnly.includes(document.id)) {
				throw new ForbiddenException('You do not have write access to this document');
			}
		}),
		emitDocumentEvent: jest.fn()
	};
	const treeService: any = {
		moveDocument: jest.fn(async (document: any, parentId: string | null) => ({ ...document, parentId }))
	};

	return { handler: new MoveDocumentHandler(documentService, treeService), documentService, treeService };
};

describe('MoveDocumentHandler — the target parent must be readable and writable', () => {
	it('refuses a target folder the caller cannot read, and moves nothing', async () => {
		const { handler, documentService, treeService } = buildHandler(['private-folder']);

		await expect(
			handler.execute(new MoveDocumentCommand('doc-1', { parentId: 'private-folder' } as any))
		).rejects.toBeInstanceOf(NotFoundException);
		expect(documentService.findOneScoped).toHaveBeenCalledWith('private-folder', [], 'org-1');
		expect(treeService.moveDocument).not.toHaveBeenCalled();
	});

	it('refuses a target folder the caller may only read, such as a VIEW share, and moves nothing', async () => {
		const { handler, documentService, treeService } = buildHandler([], ['shared-folder']);

		await expect(
			handler.execute(new MoveDocumentCommand('doc-1', { parentId: 'shared-folder' } as any))
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(documentService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({ id: 'shared-folder' }));
		expect(treeService.moveDocument).not.toHaveBeenCalled();
	});

	it('moves into a writable folder, or to the root (control)', async () => {
		const { handler, treeService } = buildHandler();

		await expect(
			handler.execute(new MoveDocumentCommand('doc-1', { parentId: 'my-folder' } as any))
		).resolves.toMatchObject({ parentId: 'my-folder' });
		await expect(
			handler.execute(new MoveDocumentCommand('doc-1', { parentId: null } as any))
		).resolves.toMatchObject({ parentId: null });
		expect(treeService.moveDocument).toHaveBeenCalledTimes(2);
	});
});
