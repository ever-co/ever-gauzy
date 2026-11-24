/**
 * A single-document read says whether the caller may change the document. A member reads every ORGANIZATION
 * page and may write only some of them: a client that learnt it from the refused save had let the person type.
 */
jest.mock('../../services/document.service', () => ({ DocumentService: class {} }));

import { GetDocumentQuery } from '../get-document.query';
import { GetDocumentHandler } from './get-document.handler';

describe('GetDocumentHandler: the read answers whether the caller may write', () => {
	const build = (mayWrite: boolean) => {
		const page = { id: 'page-1', name: 'Pier 3 safety checklist' };
		const documentService = {
			findOneScoped: jest.fn(async () => page),
			canWrite: jest.fn(async () => mayWrite)
		};
		const handler = new GetDocumentHandler(documentService as any);
		return { handler, documentService, page };
	};

	it('tells a reader who may not write the page', async () => {
		const { handler, documentService, page } = build(false);

		const answer = await handler.execute(new GetDocumentQuery('page-1', [], 'organization-1'));

		expect(documentService.findOneScoped).toHaveBeenCalledWith('page-1', [], 'organization-1');
		expect(documentService.canWrite).toHaveBeenCalledWith(page);
		expect(answer).toMatchObject({ id: 'page-1', canWrite: false });
	});

	it('tells a caller who may write it', async () => {
		const { handler } = build(true);

		const answer = await handler.execute(new GetDocumentQuery('page-1'));

		expect(answer.canWrite).toBe(true);
	});

	it('answers nothing about a page the caller may not read: the read refuses first', async () => {
		const { handler, documentService } = build(true);
		documentService.findOneScoped.mockRejectedValueOnce(new Error('Not Found'));

		await expect(handler.execute(new GetDocumentQuery('page-2'))).rejects.toThrow('Not Found');
		expect(documentService.canWrite).not.toHaveBeenCalled();
	});
});
