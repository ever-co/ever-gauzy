/**
 * Regression cover for the bulk endpoint's payload + row-level guards.
 *
 * `MOVE` used to coerce an omitted `parentId` to `null`, so a client that forgot the field
 * silently moved the entire selection to the root — a destructive, per-id-"successful" no-op.
 * And every mutating branch resolved its row with `findOneScoped` (a READ check) without ever
 * asserting write access, so a read-only share grantee could archive or delete.
 */
const permissions: string[] = [];

jest.mock(
	'@gauzy/core',
	() => ({
		RequestContext: {
			hasPermission: (permission: string) => permissions.includes(permission)
		}
	}),
	{ virtual: true }
);
jest.mock('../../services/document.service', () => ({ DocumentService: class {} }));
jest.mock('../../services/document-tree.service', () => ({ DocumentTreeService: class {} }));
jest.mock('../../services/document-knowledge.service', () => ({ DocumentKnowledgeService: class {} }));
jest.mock('../../services/document-review.service', () => ({ DocumentReviewService: class {} }));

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { DOCS_BULK_MOVE_PARENT_REQUIRED, DOCS_WRITE_FORBIDDEN } from '../../docs.constants';
import { DocumentBulkActionEnum } from '../../dto/bulk-action.dto';
import { BulkDocumentActionCommand } from '../bulk-document-action.command';
import { BulkDocumentActionHandler } from './bulk-document-action.handler';

const buildHandler = (options: { writable?: boolean } = {}) => {
	const documentService: any = {
		findOneScoped: jest.fn(async (id: string) => ({ id, organizationId: 'org-1' })),
		assertCanWrite: jest.fn(async () => {
			if (options.writable === false) {
				throw new ForbiddenException({ message: 'no write', code: DOCS_WRITE_FORBIDDEN });
			}
		}),
		save: jest.fn(async (input: any) => input),
		emitDocumentEvent: jest.fn()
	};
	const treeService: any = {
		moveDocument: jest.fn(async () => undefined),
		archiveSubtree: jest.fn(async () => 1),
		deleteDocument: jest.fn(async (document: any) => document)
	};
	const handler = new BulkDocumentActionHandler(documentService, treeService, {} as any, {} as any);
	return { handler, documentService, treeService };
};

beforeEach(() => {
	permissions.length = 0;
	permissions.push(PermissionsEnum.DOCS_MANAGE, PermissionsEnum.DOCS_DELETE);
});

describe('BulkDocumentActionHandler — MOVE payload guard', () => {
	it('rejects a MOVE with no parentId instead of moving everything to the root', async () => {
		const { handler, treeService } = buildHandler();
		const command = new BulkDocumentActionCommand({
			ids: ['doc-1', 'doc-2'],
			action: DocumentBulkActionEnum.MOVE
		} as any);

		await expect(handler.execute(command)).rejects.toBeInstanceOf(BadRequestException);
		await expect(handler.execute(command)).rejects.toMatchObject({
			response: { code: DOCS_BULK_MOVE_PARENT_REQUIRED }
		});
		expect(treeService.moveDocument).not.toHaveBeenCalled();
	});

	it('accepts an explicit null as an opt-in move to the root', async () => {
		const { handler, treeService } = buildHandler();

		const result = await handler.execute(
			new BulkDocumentActionCommand({
				ids: ['doc-1'],
				action: DocumentBulkActionEnum.MOVE,
				parentId: null
			} as any)
		);

		expect(result).toMatchObject({ requested: 1, succeeded: 1, failed: 0 });
		expect(treeService.moveDocument).toHaveBeenCalledWith(expect.objectContaining({ id: 'doc-1' }), null);
	});

	it('passes an explicit target parent straight through', async () => {
		const { handler, treeService } = buildHandler();

		await handler.execute(
			new BulkDocumentActionCommand({
				ids: ['doc-1'],
				action: DocumentBulkActionEnum.MOVE,
				parentId: 'folder-9'
			} as any)
		);

		expect(treeService.moveDocument).toHaveBeenCalledWith(expect.objectContaining({ id: 'doc-1' }), 'folder-9');
	});
});

describe('BulkDocumentActionHandler — row-level write enforcement', () => {
	it.each([
		[DocumentBulkActionEnum.ARCHIVE, {}],
		[DocumentBulkActionEnum.UNARCHIVE, {}],
		[DocumentBulkActionEnum.SET_CATEGORIES, { categoryIds: [] }],
		[DocumentBulkActionEnum.ADD_TAGS, { tagIds: [] }],
		[DocumentBulkActionEnum.REMOVE_TAGS, { tagIds: [] }],
		[DocumentBulkActionEnum.MOVE, { parentId: null }],
		[DocumentBulkActionEnum.DELETE, {}]
	])('fails %s per id when the caller has no write access to the row', async (action: any, extra: any) => {
		const { handler, documentService, treeService } = buildHandler({ writable: false });

		const result = await handler.execute(
			new BulkDocumentActionCommand({ ids: ['doc-1'], action, ...extra } as any)
		);

		expect(documentService.assertCanWrite).toHaveBeenCalled();
		expect(result).toMatchObject({
			requested: 1,
			succeeded: 0,
			failed: 1,
			results: [{ id: 'doc-1', ok: false, code: DOCS_WRITE_FORBIDDEN }]
		});
		expect(treeService.moveDocument).not.toHaveBeenCalled();
		expect(treeService.archiveSubtree).not.toHaveBeenCalled();
		expect(treeService.deleteDocument).not.toHaveBeenCalled();
		expect(documentService.save).not.toHaveBeenCalled();
	});

	it('still enforces the per-action permission matrix before any row work', async () => {
		permissions.length = 0;
		const { handler, documentService } = buildHandler();

		await expect(
			handler.execute(
				new BulkDocumentActionCommand({ ids: ['doc-1'], action: DocumentBulkActionEnum.ARCHIVE } as any)
			)
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(documentService.findOneScoped).not.toHaveBeenCalled();
	});
});
