/**
 * `POST /plugins/docs/documents/reorder` answers the same 404 for a folder that does not exist and for one the
 * caller may not read (owner decision 15, 2026-10-22).
 *
 * The handler used to hand the parent id straight to the tree, which read its children with no visibility check:
 * for a hidden folder (another member's PRIVATE folder) the caller's guess of a child id was accepted and the
 * children were reordered, while for a missing folder every id was refused with 400 — so the answer told the two
 * apart. The parent is now read through the caller's scope first, and the tree gets the caller's read filter.
 */
jest.mock('@gauzy/core', () => ({
	RequestContext: { currentTenantId: () => 'tenant-1' }
}));
jest.mock('../../services/document.service', () => ({ DocumentService: class DocumentService {} }));
jest.mock('../../services/document-tree.service', () => ({ DocumentTreeService: class DocumentTreeService {} }));
jest.mock('../../dto', () => ({}));

import { NotFoundException } from '@nestjs/common';
import { ReorderDocumentsCommand } from '../reorder-documents.command';
import { ReorderDocumentsHandler } from './reorder-documents.handler';

const HIDDEN = 'a0000000-0000-4000-8000-00000000000a';
const MISSING = 'b0000000-0000-4000-8000-00000000000b';
const VISIBLE = 'c0000000-0000-4000-8000-00000000000c';
const CHILD = 'd0000000-0000-4000-8000-00000000000d';

function build() {
	const documentService = {
		resolveOrganizationId: jest.fn(() => 'org-1'),
		// What `findOneScoped` answers: a hidden row and a missing row are the same 404.
		findOneScoped: jest.fn(async (id: string) => {
			if (id === VISIBLE) {
				return { id, organizationId: 'org-1' };
			}
			throw new NotFoundException(`Document ${id} was not found`);
		}),
		filterReadableDocumentIds: jest.fn(async (ids: string[]) => ids)
	};
	const treeService = { reorderDocuments: jest.fn(async () => undefined) };
	const handler = new ReorderDocumentsHandler(documentService as any, treeService as any);
	return { handler, documentService, treeService };
}

const reorder = (parentId: string | null) => new ReorderDocumentsCommand({ parentId, orderedIds: [CHILD] });

describe('ReorderDocumentsHandler — no folder existence oracle', () => {
	it('answers a hidden folder and a missing one with the same 404, and reorders nothing', async () => {
		const { handler, treeService } = build();

		const hidden = await handler.execute(reorder(HIDDEN)).catch((error) => error);
		const missing = await handler.execute(reorder(MISSING)).catch((error) => error);

		expect(hidden).toBeInstanceOf(NotFoundException);
		expect(missing).toBeInstanceOf(NotFoundException);
		expect(hidden.getStatus()).toBe(missing.getStatus());
		expect(hidden.message.replace(HIDDEN, '<id>')).toBe(missing.message.replace(MISSING, '<id>'));
		expect(treeService.reorderDocuments).not.toHaveBeenCalled();
	});

	it('reads the parent in the organization the reorder runs in', async () => {
		const { handler, documentService } = build();

		await handler.execute(reorder(VISIBLE));

		expect(documentService.findOneScoped).toHaveBeenCalledWith(VISIBLE, [], 'org-1');
	});

	it("hands the tree the caller's read filter for the siblings, in that organization", async () => {
		const { handler, documentService, treeService } = build();

		await handler.execute(reorder(VISIBLE));

		expect(treeService.reorderDocuments).toHaveBeenCalledWith(
			VISIBLE,
			[CHILD],
			'tenant-1',
			'org-1',
			expect.any(Function)
		);
		const readable = (treeService.reorderDocuments.mock.calls[0] as unknown[])[4] as (ids: string[]) => unknown;
		await readable([CHILD]);
		expect(documentService.filterReadableDocumentIds).toHaveBeenCalledWith([CHILD], 'org-1');
	});

	it('reorders the root siblings without a parent lookup, in the resolved organization', async () => {
		const { handler, documentService, treeService } = build();

		await handler.execute(reorder(null));

		expect(documentService.findOneScoped).not.toHaveBeenCalled();
		expect(treeService.reorderDocuments).toHaveBeenCalledWith(
			null,
			[CHILD],
			'tenant-1',
			'org-1',
			expect.any(Function)
		);
	});
});
