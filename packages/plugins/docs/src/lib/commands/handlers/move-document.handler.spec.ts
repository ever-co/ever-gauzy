/**
 * `POST /plugins/docs/documents/:id/move` reads its target parent the way a create reads its parent.
 *
 * The tree's own parent lookup checks only the organization, so a writer could move a document into another
 * member's PRIVATE folder by its id (and learn from the answer that the folder exists).
 */
jest.mock('../../services/document.service', () => ({ DocumentService: class {} }));
jest.mock('../../services/document-tree.service', () => ({ DocumentTreeService: class {} }));

import { NotFoundException } from '@nestjs/common';
import { MoveDocumentCommand } from '../move-document.command';
import { MoveDocumentHandler } from './move-document.handler';

const buildHandler = (unreadable: string[] = []) => {
	const documentService: any = {
		findOneScoped: jest.fn(async (id: string) => {
			if (unreadable.includes(id)) {
				throw new NotFoundException('Document was not found');
			}
			return { id, organizationId: 'org-1', parentId: null };
		}),
		assertCanWrite: jest.fn(async () => undefined),
		emitDocumentEvent: jest.fn()
	};
	const treeService: any = {
		moveDocument: jest.fn(async (document: any, parentId: string | null) => ({ ...document, parentId }))
	};

	return { handler: new MoveDocumentHandler(documentService, treeService), documentService, treeService };
};

describe('MoveDocumentHandler — the target parent must be readable', () => {
	it('refuses a target folder the caller cannot read, and moves nothing', async () => {
		const { handler, documentService, treeService } = buildHandler(['private-folder']);

		await expect(
			handler.execute(new MoveDocumentCommand('doc-1', { parentId: 'private-folder' } as any))
		).rejects.toBeInstanceOf(NotFoundException);
		expect(documentService.findOneScoped).toHaveBeenCalledWith('private-folder', [], 'org-1');
		expect(treeService.moveDocument).not.toHaveBeenCalled();
	});

	it('moves into a readable folder, or to the root (control)', async () => {
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
