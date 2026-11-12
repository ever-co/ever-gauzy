const requestContext = { userId: 'user-1' as string | null, employeeId: 'employee-1' as string | null, tenantId: 'tenant-1' };
/** The organizations the caller reaches (`assertCurrentUserBelongsToOrganization`). */
const reachable = new Set<string>(['org-1']);
jest.mock('@gauzy/core', () => ({
	Comment: class Comment {},
	FeatureService: class FeatureService {},
	assertCurrentUserBelongsToOrganization: jest.fn(async (_manager: unknown, organizationId: string) => {
		if (!reachable.has(organizationId)) {
			const { ForbiddenException } = jest.requireActual('@nestjs/common');
			throw new ForbiddenException('You are not a member of this organization');
		}
	}),
	RequestContext: {
		currentUserId: () => requestContext.userId,
		currentUser: () => (requestContext.userId ? { id: requestContext.userId, employeeId: requestContext.employeeId } : null),
		currentTenantId: () => requestContext.tenantId
	}
}));
jest.mock('./document.service', () => ({ DocumentService: class DocumentService {} }));
/** The plugin's configuration as the service reads it (Docs collaboration on unless a test turns it off). */
const mockConfig = { collabEnabled: true };
jest.mock('../docs.config', () => ({ getDocsConfig: () => mockConfig }));
jest.mock('./document-comment-access.policy', () => ({ DocumentCommentAccessPolicy: class DocumentCommentAccessPolicy {} }));
jest.mock('../repositories/type-orm-document-comment-anchor.repository', () => ({
	TypeOrmDocumentCommentAnchorRepository: class TypeOrmDocumentCommentAnchorRepository {}
}));
jest.mock('../entities/document-comment-anchor.entity', () => ({ DocumentCommentAnchor: class DocumentCommentAnchor {} }));
jest.mock('../entities/document.entity', () => ({ Document: class Document {} }));

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as Y from 'yjs';
import { BaseEntityEnum, DocumentCommentAnchorMethodEnum, DocumentCommentAnchorStatusEnum, FeatureEnum } from '@gauzy/contracts';
import {
	DOCS_COLLAB_DISABLED,
	DOCS_COMMENT_ANCHOR_FORBIDDEN,
	DOCS_COMMENT_ANCHOR_INVALID,
	DOCS_COMMENT_ANCHOR_REPLY,
	DOCS_COMMENT_NOT_FOUND
} from '../docs.constants';
import { encodeLiveState, LIVE_FRAGMENT, lineageOf, seedLiveDocument } from '../live/document-live.yjs';
import { DocumentCommentAnchorService, normaliseAnchorInput } from './document-comment-anchor.service';

const PAGE_ID = '5b1d7a3e-2c4f-4e8a-9b6d-1f0e3c2a4b50';
const COMMENT_ID = '6c2e8b4f-3d5a-4f9b-8c7e-2a1f4d3b5c61';
const OTHER_COMMENT_ID = '7d3f9c5a-4e6b-4a0c-9d8f-3b2a5e4c6d72';

const paragraph = (blockId: string, text: string) => ({ type: 'paragraph', attrs: { blockId }, content: [{ type: 'text', text }] });

interface IRow {
	id: string;
	tenantId: string;
	organizationId: string;
	commentId: string;
	documentId: string;
	blockId: string;
	startOffset: number;
	endOffset: number;
	quote: string;
	prefix?: string | null;
	suffix?: string | null;
	relativeStart?: string | null;
	relativeEnd?: string | null;
	createdAt?: Date;
	updatedAt?: Date;
}

/** The service over one page, a table of anchors and a table of comments. */
function buildService(
	options: {
		contentJson?: unknown;
		contentBinary?: Buffer | null;
		revision?: number;
		comments?: Array<Record<string, unknown>>;
		rows?: IRow[];
		takesComments?: boolean;
		/** The page exists but the caller may not read it (the page route's 404). */
		readable?: boolean;
		/** FEATURE_DOCUMENTS for the page's organization (on unless a test turns it off). */
		docsEnabled?: boolean;
	} = {}
) {
	const page = {
		id: PAGE_ID,
		tenantId: 'tenant-1',
		organizationId: 'org-1',
		contentRevision: options.revision ?? 2,
		contentJson: options.contentJson ?? { type: 'doc', content: [paragraph('b1', 'The quick brown fox jumps over the lazy dog.')] },
		contentBinary: options.contentBinary ?? null
	};
	const rows: IRow[] = [...(options.rows ?? [])];
	const comments = options.comments ?? [
		{ id: COMMENT_ID, parentId: null, employeeId: 'employee-1', createdByUserId: 'user-1', entity: BaseEntityEnum.Document, entityId: PAGE_ID, tenantId: 'tenant-1' }
	];
	const matches = (comment: Record<string, unknown>, where: Record<string, unknown>) =>
		Object.entries(where).every(([key, value]) => {
			if (value && typeof value === 'object' && '_value' in (value as object)) return ((value as { _value: unknown[] })._value).map(String).includes(String(comment[key]));
			return String(comment[key]) === String(value);
		});
	const manager = {
		findOne: jest.fn(async (_entity: unknown, { where }: { where: Record<string, unknown> }) => comments.find((comment) => matches(comment, where)) ?? null),
		find: jest.fn(async (_entity: unknown, { where }: { where: Record<string, unknown> }) => comments.filter((comment) => matches(comment, where)))
	};
	const repository = {
		manager,
		find: jest.fn(async ({ where }: { where: Partial<IRow> }) => rows.filter((row) => row.documentId === where.documentId && row.tenantId === where.tenantId)),
		findOne: jest.fn(async ({ where }: { where: Partial<IRow> }) => rows.find((row) => row.commentId === where.commentId && row.tenantId === where.tenantId) ?? null),
		create: jest.fn((row: IRow) => ({ ...row })),
		save: jest.fn(async (row: IRow) => {
			const saved = { id: row.id ?? `anchor-${rows.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...row };
			const at = rows.findIndex((existing) => existing.commentId === row.commentId);
			if (at >= 0) rows[at] = saved;
			else rows.push(saved);
			return saved;
		}),
		delete: jest.fn(async (where: Partial<IRow>) => {
			const before = rows.length;
			for (let at = rows.length - 1; at >= 0; at -= 1) if (rows[at].commentId === where.commentId && rows[at].documentId === where.documentId) rows.splice(at, 1);
			return { affected: before - rows.length };
		})
	};
	const documents = {
		findOneScoped: jest.fn(async (id: string) => {
			if (id !== PAGE_ID || options.readable === false) throw new NotFoundException();
			return page;
		})
	};
	// The comment API's write rule for the page (a VIEW share answers null).
	const commentAccess = {
		findWritableParent: jest.fn(async (id: string) => (options.takesComments === false || id !== PAGE_ID ? null : { id, organizationId: 'org-1' }))
	};
	// FEATURE_DOCUMENTS as the routes' guard resolves it.
	const features = { isFeatureEnabled: jest.fn(async () => options.docsEnabled !== false) };
	const service = new DocumentCommentAnchorService(documents as never, repository as never, commentAccess as never, features as never);
	return { service, documents, repository, rows, page, commentAccess, features };
}

/** The response body of the exception a promise rejects with. */
async function rejectionOf(promise: Promise<unknown>): Promise<{ error: unknown; body: Record<string, unknown> }> {
	try {
		await promise;
	} catch (error) {
		return { error, body: (error as { getResponse?: () => Record<string, unknown> }).getResponse?.() ?? {} };
	}
	throw new Error('expected a rejection');
}

const anchorInput = { blockId: 'b1', start: 10, end: 19, quote: 'brown fox', prefix: 'The quick ', suffix: ' jumps over' };

describe('DocumentCommentAnchorService', () => {
	beforeEach(() => {
		requestContext.userId = 'user-1';
		requestContext.employeeId = 'employee-1';
		reachable.clear();
		reachable.add('org-1');
		mockConfig.collabEnabled = true;
	});

	it('is not there while Docs collaboration is off: 404 on the routes, no anchor on a comment', async () => {
		mockConfig.collabEnabled = false;
		const rows: IRow[] = [
			{ id: 'a1', tenantId: 'tenant-1', organizationId: 'org-1', commentId: COMMENT_ID, documentId: PAGE_ID, blockId: 'b1', startOffset: 10, endOffset: 19, quote: 'brown fox' }
		];
		const { service, repository } = buildService({ rows });
		for (const call of [service.list(PAGE_ID), service.set(PAGE_ID, COMMENT_ID, anchorInput), service.remove(PAGE_ID, COMMENT_ID)]) {
			const { error, body } = await rejectionOf(call);
			expect(error).toBeInstanceOf(NotFoundException);
			expect(body.code).toBe(DOCS_COLLAB_DISABLED);
		}
		expect(await service.ofComment({ id: COMMENT_ID, entity: BaseEntityEnum.Document, entityId: PAGE_ID, tenantId: 'tenant-1' })).toBeNull();
		expect(repository.save).not.toHaveBeenCalled();
		expect(rows).toHaveLength(1);
	});

	it('stores the anchor of its author, and answers it found in the page', async () => {
		const { service, rows } = buildService();
		const saved = await service.set(PAGE_ID, COMMENT_ID, anchorInput);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ commentId: COMMENT_ID, documentId: PAGE_ID, tenantId: 'tenant-1', organizationId: 'org-1', startOffset: 10, endOffset: 19, quote: 'brown fox' });
		expect(saved).toMatchObject({ commentId: COMMENT_ID, start: 10, end: 19, position: { status: DocumentCommentAnchorStatusEnum.EXACT, blockId: 'b1', start: 10, end: 19 } });
	});

	it('replaces the anchor of a comment rather than adding a second one', async () => {
		const { service, rows } = buildService();
		await service.set(PAGE_ID, COMMENT_ID, anchorInput);
		await service.set(PAGE_ID, COMMENT_ID, { blockId: 'b1', start: 0, end: 3, quote: 'The' });
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ startOffset: 0, endOffset: 3, quote: 'The', prefix: null });
	});

	it('lets nobody but the author place a comment', async () => {
		requestContext.userId = 'user-2';
		requestContext.employeeId = 'employee-2';
		const { service, rows } = buildService();
		const { error, body } = await rejectionOf(service.set(PAGE_ID, COMMENT_ID, anchorInput));
		expect(error).toBeInstanceOf(ForbiddenException);
		expect(body.code).toBe(DOCS_COMMENT_ANCHOR_FORBIDDEN);
		expect(rows).toHaveLength(0);
	});

	it('refuses the author a change on a page that no longer takes their comments (a VIEW share), nothing written', async () => {
		const rows: IRow[] = [
			{ id: 'a1', tenantId: 'tenant-1', organizationId: 'org-1', commentId: COMMENT_ID, documentId: PAGE_ID, blockId: 'b1', startOffset: 10, endOffset: 19, quote: 'brown fox' }
		];
		const { service, commentAccess } = buildService({ rows, takesComments: false });
		const set = await rejectionOf(service.set(PAGE_ID, COMMENT_ID, { blockId: 'b1', start: 0, end: 3, quote: 'The' }));
		expect(set.error).toBeInstanceOf(ForbiddenException);
		expect(set.body.code).toBe(DOCS_COMMENT_ANCHOR_FORBIDDEN);
		const removed = await rejectionOf(service.remove(PAGE_ID, COMMENT_ID));
		expect(removed.error).toBeInstanceOf(ForbiddenException);
		expect(commentAccess.findWritableParent).toHaveBeenCalledWith(PAGE_ID);
		expect(rows).toEqual([expect.objectContaining({ startOffset: 10, quote: 'brown fox' })]);
		// Reading them stays the page's read rule.
		expect((await service.list(PAGE_ID)).items).toHaveLength(1);
	});

	it('takes the author by their user when they have no employee', async () => {
		requestContext.employeeId = null;
		const { service, rows } = buildService({
			comments: [{ id: COMMENT_ID, parentId: null, employeeId: null, createdByUserId: 'user-1', entity: BaseEntityEnum.Document, entityId: PAGE_ID, tenantId: 'tenant-1' }]
		});
		await service.set(PAGE_ID, COMMENT_ID, anchorInput);
		expect(rows).toHaveLength(1);
	});

	it('refuses a reply, a comment of another page, and a page the caller may not read', async () => {
		const reply = buildService({
			comments: [{ id: COMMENT_ID, parentId: OTHER_COMMENT_ID, employeeId: 'employee-1', createdByUserId: 'user-1', entity: BaseEntityEnum.Document, entityId: PAGE_ID, tenantId: 'tenant-1' }]
		});
		const replied = await rejectionOf(reply.service.set(PAGE_ID, COMMENT_ID, anchorInput));
		expect(replied.error).toBeInstanceOf(BadRequestException);
		expect(replied.body.code).toBe(DOCS_COMMENT_ANCHOR_REPLY);

		const elsewhere = buildService({
			comments: [{ id: COMMENT_ID, parentId: null, employeeId: 'employee-1', createdByUserId: 'user-1', entity: BaseEntityEnum.Task, entityId: PAGE_ID, tenantId: 'tenant-1' }]
		});
		const missing = await rejectionOf(elsewhere.service.set(PAGE_ID, COMMENT_ID, anchorInput));
		expect(missing.error).toBeInstanceOf(NotFoundException);
		expect(missing.body.code).toBe(DOCS_COMMENT_NOT_FOUND);

		const { service } = buildService();
		await expect(service.set('00000000-0000-4000-8000-000000000000', COMMENT_ID, anchorInput)).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.list('00000000-0000-4000-8000-000000000000')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('answers an existing page the caller may not read as missing, writing and showing nothing', async () => {
		const rows: IRow[] = [
			{ id: 'a1', tenantId: 'tenant-1', organizationId: 'org-1', commentId: COMMENT_ID, documentId: PAGE_ID, blockId: 'b1', startOffset: 10, endOffset: 19, quote: 'brown fox' }
		];
		const { service, repository, commentAccess } = buildService({ rows, readable: false });
		await expect(service.list(PAGE_ID)).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.set(PAGE_ID, COMMENT_ID, anchorInput)).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.remove(PAGE_ID, COMMENT_ID)).rejects.toBeInstanceOf(NotFoundException);
		expect(await service.ofComment({ id: COMMENT_ID, entity: BaseEntityEnum.Document, entityId: PAGE_ID, tenantId: 'tenant-1' })).toBeNull();
		expect(repository.save).not.toHaveBeenCalled();
		expect(repository.delete).not.toHaveBeenCalled();
		expect(commentAccess.findWritableParent).not.toHaveBeenCalled();
		expect(rows).toHaveLength(1);
	});

	it('lists the anchors of comments that are still there, found again in the edited page', async () => {
		const rows: IRow[] = [
			{ id: 'a1', tenantId: 'tenant-1', organizationId: 'org-1', commentId: COMMENT_ID, documentId: PAGE_ID, blockId: 'b1', startOffset: 10, endOffset: 19, quote: 'brown fox', prefix: 'The quick ', suffix: ' jumps' },
			// The comment of this one was withdrawn: it is not listed.
			{ id: 'a2', tenantId: 'tenant-1', organizationId: 'org-1', commentId: OTHER_COMMENT_ID, documentId: PAGE_ID, blockId: 'b1', startOffset: 0, endOffset: 3, quote: 'The' }
		];
		const { service } = buildService({ rows, contentJson: { type: 'doc', content: [paragraph('b0', 'Intro'), paragraph('b1', 'Now the quick brown fox jumps.')] } });
		const list = await service.list(PAGE_ID);
		expect(list).toMatchObject({ documentId: PAGE_ID, revision: 2, live: false });
		expect(list.items).toHaveLength(1);
		expect(list.items[0].position).toEqual({
			status: DocumentCommentAnchorStatusEnum.MOVED,
			method: DocumentCommentAnchorMethodEnum.QUOTE,
			blockId: 'b1',
			start: 14,
			end: 23,
			text: 'brown fox'
		});
	});

	it("reads the page's live state and the anchors' relative positions when the page has one", async () => {
		const json = { type: 'doc', content: [paragraph('b1', 'Hello brave new world')] };
		const doc = seedLiveDocument(PAGE_ID, 2, json);
		const text = (doc.getXmlFragment(LIVE_FRAGMENT).get(0) as Y.XmlElement).get(0) as Y.XmlText;
		const relative = (index: number) => Buffer.from(Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(text, index))).toString('base64');
		const relativeStart = relative(6);
		const relativeEnd = relative(11);
		// Someone typed before the range since: the stored JSON is behind, the live state is not.
		text.insert(0, 'Oh, ');
		const contentBinary = encodeLiveState(doc, { lineage: lineageOf(PAGE_ID, 2), revision: 2 });
		const rows: IRow[] = [
			{ id: 'a1', tenantId: 'tenant-1', organizationId: 'org-1', commentId: COMMENT_ID, documentId: PAGE_ID, blockId: 'b1', startOffset: 6, endOffset: 11, quote: 'brave', relativeStart, relativeEnd }
		];
		const { service } = buildService({ rows, contentJson: json, contentBinary, revision: 2 });
		const list = await service.list(PAGE_ID);
		expect(list.live).toBe(true);
		expect(list.items[0].position).toMatchObject({ status: DocumentCommentAnchorStatusEnum.EXACT, method: DocumentCommentAnchorMethodEnum.RELATIVE, start: 10, end: 15, text: 'brave' });
	});

	it('answers the anchor of one comment for the GraphQL field, reading its page once per request', async () => {
		const rows: IRow[] = [
			{ id: 'a1', tenantId: 'tenant-1', organizationId: 'org-1', commentId: COMMENT_ID, documentId: PAGE_ID, blockId: 'b1', startOffset: 10, endOffset: 19, quote: 'brown fox' }
		];
		const { service, documents } = buildService({ rows });
		const pages = new Map();
		const comment = { id: COMMENT_ID, entity: BaseEntityEnum.Document, entityId: PAGE_ID, tenantId: 'tenant-1' };
		expect(await service.ofComment(comment, pages)).toMatchObject({ commentId: COMMENT_ID, position: { status: DocumentCommentAnchorStatusEnum.EXACT } });
		await service.ofComment(comment, pages);
		expect(documents.findOneScoped).toHaveBeenCalledTimes(1);
		expect(await service.ofComment({ id: COMMENT_ID, entity: BaseEntityEnum.Task, entityId: PAGE_ID })).toBeNull();
		expect(await service.ofComment({ id: OTHER_COMMENT_ID, entity: BaseEntityEnum.Document, entityId: PAGE_ID })).toBeNull();
	});

	it("answers no anchor for the GraphQL field when the caller does not reach the page's organization", async () => {
		const rows: IRow[] = [
			{ id: 'a1', tenantId: 'tenant-1', organizationId: 'org-1', commentId: COMMENT_ID, documentId: PAGE_ID, blockId: 'b1', startOffset: 10, endOffset: 19, quote: 'brown fox' }
		];
		const { service, documents } = buildService({ rows });
		reachable.clear();
		expect(await service.ofComment({ id: COMMENT_ID, entity: BaseEntityEnum.Document, entityId: PAGE_ID, tenantId: 'tenant-1' })).toBeNull();
		expect(documents.findOneScoped).not.toHaveBeenCalled();
	});

	it("answers no anchor for the GraphQL field where Docs is off for the page's organization (no guard runs on a field)", async () => {
		const rows: IRow[] = [
			{ id: 'a1', tenantId: 'tenant-1', organizationId: 'org-1', commentId: COMMENT_ID, documentId: PAGE_ID, blockId: 'b1', startOffset: 10, endOffset: 19, quote: 'brown fox' }
		];
		const { service, documents, features } = buildService({ rows, docsEnabled: false });
		expect(await service.ofComment({ id: COMMENT_ID, entity: BaseEntityEnum.Document, entityId: PAGE_ID, tenantId: 'tenant-1' })).toBeNull();
		expect(features.isFeatureEnabled).toHaveBeenCalledWith(FeatureEnum.FEATURE_DOCUMENTS);
		expect(documents.findOneScoped).not.toHaveBeenCalled();
	});

	it('refuses an organization argument the caller does not reach', async () => {
		const { service } = buildService();
		await expect(service.assertOrganization('org-2')).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.assertOrganization('org-1')).resolves.toBeUndefined();
		await expect(service.assertOrganization(undefined)).resolves.toBeUndefined();
	});

	it('removes the anchor of its author', async () => {
		const { service, rows } = buildService();
		await service.set(PAGE_ID, COMMENT_ID, anchorInput);
		expect(await service.remove(PAGE_ID, COMMENT_ID)).toBe(true);
		expect(rows).toHaveLength(0);
		expect(await service.remove(PAGE_ID, COMMENT_ID)).toBe(false);
	});
});

describe('normaliseAnchorInput', () => {
	const invalid = (input: unknown) => {
		try {
			normaliseAnchorInput(input as never);
		} catch (error) {
			expect(error).toBeInstanceOf(BadRequestException);
			return (error as BadRequestException).getResponse() as Record<string, unknown>;
		}
		throw new Error('expected a refusal');
	};

	it('keeps a valid anchor, empty context and relative positions as null', () => {
		expect(normaliseAnchorInput({ blockId: 'b-1', start: 2, end: 5, quote: 'abc', prefix: '', suffix: 'x' })).toEqual({
			blockId: 'b-1',
			start: 2,
			end: 5,
			quote: 'abc',
			prefix: null,
			suffix: 'x',
			relativeStart: null,
			relativeEnd: null
		});
	});

	it('refuses what cannot be stored', () => {
		expect(invalid(null).code).toBe(DOCS_COMMENT_ANCHOR_INVALID);
		expect(invalid({ blockId: 'bad id', start: 0, end: 1, quote: 'a' }).code).toBe(DOCS_COMMENT_ANCHOR_INVALID);
		expect(invalid({ blockId: 'b', start: 3, end: 1, quote: 'a' }).code).toBe(DOCS_COMMENT_ANCHOR_INVALID);
		expect(invalid({ blockId: 'b', start: 0, end: 4, quote: 'abc' }).code).toBe(DOCS_COMMENT_ANCHOR_INVALID);
		expect(invalid({ blockId: 'b', start: 0, end: 1001, quote: 'a'.repeat(1001) }).code).toBe(DOCS_COMMENT_ANCHOR_INVALID);
		expect(invalid({ blockId: 'b', start: 0, end: 1, quote: 'a', prefix: 'p'.repeat(33) }).code).toBe(DOCS_COMMENT_ANCHOR_INVALID);
		expect(invalid({ blockId: 'b', start: 0, end: 1, quote: 'a', relativeStart: 'AAAA' }).code).toBe(DOCS_COMMENT_ANCHOR_INVALID);
		expect(invalid({ blockId: 'b', start: 0, end: 1, quote: 'a', relativeStart: 'not base64!', relativeEnd: 'AAAA' }).code).toBe(DOCS_COMMENT_ANCHOR_INVALID);
	});
});
