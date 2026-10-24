/**
 * The archive, unarchive and delete routes hand the tree the caller's read filter, bound to the document's own
 * organization, so their cascade reaches only the descendants the caller may read (owner decision 15, 2026-10-22).
 * Before, they cascaded over every row of the subtree: another member's PRIVATE page inside the caller's folder was
 * archived or deleted with it, and the subtree-delete refusal named it.
 */
jest.mock('../../services/document.service', () => ({ DocumentService: class {} }));
jest.mock('../../services/document-tree.service', () => ({ DocumentTreeService: class {} }));
jest.mock('../../dto', () => ({}));

import { ArchiveDocumentCommand } from '../archive-document.command';
import { DeleteDocumentCommand } from '../delete-document.command';
import { UnarchiveDocumentCommand } from '../unarchive-document.command';
import { ArchiveDocumentHandler } from './archive-document.handler';
import { DeleteDocumentHandler } from './delete-document.handler';
import { UnarchiveDocumentHandler } from './unarchive-document.handler';

const DOCUMENT = { id: 'folder-1', organizationId: 'org-7', isArchived: true };

function build() {
	const documentService = {
		findOneScoped: jest.fn(async () => ({ ...DOCUMENT })),
		assertCanWrite: jest.fn(async () => undefined),
		emitDocumentEvent: jest.fn(),
		filterReadableDocumentIds: jest.fn(async (ids: string[]) => ids.slice(0, 1))
	};
	const treeService = {
		archiveSubtree: jest.fn(async () => 1),
		unarchiveSubtree: jest.fn(async () => 1),
		deleteDocument: jest.fn(async () => ({ ...DOCUMENT }))
	};
	return { documentService, treeService };
}

/** Calls the filter a tree method received and checks it is the caller's, in the document's organization. */
async function expectReadFilter(filter: unknown, documentService: ReturnType<typeof build>['documentService']) {
	expect(filter).toEqual(expect.any(Function));
	await expect((filter as (ids: string[]) => Promise<string[]>)(['a', 'b'])).resolves.toEqual(['a']);
	expect(documentService.filterReadableDocumentIds).toHaveBeenCalledWith(['a', 'b'], 'org-7');
}

describe('subtree routes cascade only to what the caller may read', () => {
	it('archive', async () => {
		const { documentService, treeService } = build();

		await new ArchiveDocumentHandler(documentService as any, treeService as any).execute(
			new ArchiveDocumentCommand('folder-1')
		);

		await expectReadFilter((treeService.archiveSubtree.mock.calls[0] as unknown[])[1], documentService);
	});

	it('unarchive', async () => {
		const { documentService, treeService } = build();

		await new UnarchiveDocumentHandler(documentService as any, treeService as any).execute(
			new UnarchiveDocumentCommand('folder-1')
		);

		await expectReadFilter((treeService.unarchiveSubtree.mock.calls[0] as unknown[])[1], documentService);
	});

	it('delete', async () => {
		const { documentService, treeService } = build();

		await new DeleteDocumentHandler(documentService as any, treeService as any).execute(
			new DeleteDocumentCommand('folder-1', 'subtree')
		);

		const [, strategy, filter] = treeService.deleteDocument.mock.calls[0] as unknown[];
		expect(strategy).toBe('subtree');
		await expectReadFilter(filter, documentService);
	});
});
