jest.mock('@gauzy/core', () => ({ Comment: class Comment {} }));
jest.mock('./document.service', () => ({ DocumentService: class DocumentService {} }));
jest.mock('./document-upload.service', () => ({ DocumentUploadService: class DocumentUploadService {} }));
jest.mock('../repositories/type-orm-document.repository', () => ({ TypeOrmDocumentRepository: class TypeOrmDocumentRepository {} }));
jest.mock('../dto/update-document-content.dto', () => ({}));
jest.mock('../dto/update-document-markdown.dto', () => ({}));

import { ConflictException } from '@nestjs/common';
import { DocumentKindEnum } from '@gauzy/contracts';
import { DOCS_CONTENT_CONFLICT, DOCS_MARKDOWN_AMBIGUOUS } from '../docs.constants';
import { IDocNode } from './document-markdown';
import { DocumentMarkdownService } from './document-markdown.service';

const PAGE_ID = '7a0c3f52-1b9e-4c55-9d1f-0a8d2b6e4c11';
const paragraph = (value: string, blockId: string): IDocNode => ({ type: 'paragraph', attrs: { blockId }, content: [{ type: 'text', text: value }] });

/** The service over a page with the given blocks, and a comment table holding the given bodies. */
function buildService(blocks: IDocNode[], commentBodies: string[] = []) {
	const page = {
		id: PAGE_ID,
		tenantId: 'tenant-1',
		organizationId: 'org-1',
		kind: DocumentKindEnum.PAGE,
		isLocked: false,
		contentRevision: 3,
		updatedAt: new Date('2026-11-08T10:00:00Z'),
		contentJson: { type: 'doc', content: blocks }
	};
	const documents = {
		findOneScoped: jest.fn(async () => page),
		assertCanWrite: jest.fn(async () => undefined),
		updateContent: jest.fn(async (_id: string, input: { contentJson: IDocNode }) => ({ ...page, contentJson: input.contentJson, contentRevision: 4 }))
	};
	const manager = { find: jest.fn(async () => commentBodies.map((comment, index) => ({ id: `comment-${index}`, comment }))) };
	const service = new DocumentMarkdownService(documents as never, {} as never, { manager } as never);
	return { service, documents, manager, page };
}

/** The response body of the exception a promise rejects with. */
async function rejectionOf(promise: Promise<unknown>): Promise<{ error: unknown; body: Record<string, unknown> }> {
	try {
		await promise;
	} catch (error) {
		return { error, body: (error as ConflictException).getResponse() as Record<string, unknown> };
	}
	throw new Error('expected a rejection');
}

describe('DocumentMarkdownService.updateFromMarkdown', () => {
	it('refuses with 409 an update that would leave a commented block among identical twins to a guess, writing nothing', async () => {
		const blocks = [paragraph('same', 'x1'), paragraph('same', 'x2'), paragraph('alpha', 'a')];
		const { service, documents } = buildService(blocks, ['[[block:x2]]\nPlease reword', 'A page-level comment']);
		// One of the two identical paragraphs removed: the text cannot tell whether the commented one is still there.
		const { error, body } = await rejectionOf(service.updateFromMarkdown(PAGE_ID as never, { markdown: 'same\n\nalpha\n', expectedRevision: 3 } as never));
		expect(error).toBeInstanceOf(ConflictException);
		expect(body).toEqual(expect.objectContaining({ code: DOCS_MARKDOWN_AMBIGUOUS, currentRevision: 3, blockIds: ['x2'] }));
		expect(documents.updateContent).not.toHaveBeenCalled();
	});

	it('answers a stale revision before the ambiguity, as any write would', async () => {
		const { service } = buildService([paragraph('same', 'x1'), paragraph('same', 'x2')], ['[[block:x1]]\nnote']);
		const { body } = await rejectionOf(service.updateFromMarkdown(PAGE_ID as never, { markdown: 'same\n', expectedRevision: 2 } as never));
		expect(body).toEqual(expect.objectContaining({ code: DOCS_CONTENT_CONFLICT, currentRevision: 3 }));
	});

	it('writes the same update when no comment is anchored to the twins', async () => {
		const blocks = [paragraph('same', 'x1'), paragraph('same', 'x2'), paragraph('alpha', 'a')];
		const { service, documents } = buildService(blocks, ['[[block:a]]\nOn alpha']);
		const result = await service.updateFromMarkdown(PAGE_ID as never, { markdown: 'same\n\nalpha\n', expectedRevision: 3 } as never);
		expect(result).toEqual(expect.objectContaining({ changed: true, revision: 4 }));
		expect(documents.updateContent).toHaveBeenCalledTimes(1);
	});

	it('keeps a moved commented block and writes, without reading the comments when nothing is a guess', async () => {
		const blocks = [paragraph('alpha', 'a'), paragraph('beta', 'b')];
		const { service, documents, manager } = buildService(blocks, ['[[block:a]]\nOn alpha']);
		const result = await service.updateFromMarkdown(PAGE_ID as never, { markdown: 'beta\n\nalpha\n', expectedRevision: 3 } as never);
		expect(result).toEqual(expect.objectContaining({ changed: true, changedBlocks: 0, keptBlocks: 2 }));
		const written = (documents.updateContent.mock.calls[0] as unknown as [string, { contentJson: IDocNode }])[1].contentJson;
		expect(written.content).toEqual([blocks[1], blocks[0]]);
		expect(manager.find).not.toHaveBeenCalled();
	});
});
