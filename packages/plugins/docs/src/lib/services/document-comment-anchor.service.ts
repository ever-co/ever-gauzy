import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import {
	BaseEntityEnum,
	FeatureEnum,
	ID,
	IDocumentCommentAnchor,
	IDocumentCommentAnchorInput,
	IDocumentCommentAnchorList,
	IDocumentCommentAnchorResolved
} from '@gauzy/contracts';
import { assertCurrentUserBelongsToOrganization, Comment, FeatureService, RequestContext } from '@gauzy/core';
import { getDocsConfig } from '../docs.config';
import {
	DOCS_COLLAB_DISABLED,
	DOCS_COMMENT_ANCHOR_FORBIDDEN,
	DOCS_COMMENT_ANCHOR_INVALID,
	DOCS_COMMENT_ANCHOR_REPLY,
	DOCS_COMMENT_NOT_FOUND
} from '../docs.constants';
import { Document } from '../entities/document.entity';
import { DocumentCommentAnchor } from '../entities/document-comment-anchor.entity';
import { decodeLiveState, liveDocumentJson, liveRevisionOf } from '../live/document-live.yjs';
import { TypeOrmDocumentCommentAnchorRepository } from '../repositories/type-orm-document-comment-anchor.repository';
import {
	anchorBlocksOf,
	DOCS_ANCHOR_CONTEXT_MAX_LENGTH,
	DOCS_ANCHOR_FUZZY_BUDGET,
	DOCS_ANCHOR_QUOTE_MAX_LENGTH,
	DOCS_ANCHOR_RELATIVE_MAX_LENGTH,
	IAnchorBlock,
	LiveAnchorResolver,
	liveAnchorResolverOf,
	resolveCommentAnchor
} from './document-comment-anchor';
import { DocumentCommentAccessPolicy } from './document-comment-access.policy';
import { DocumentService } from './document.service';

/** The block ids the editors write (`[[block:<blockId>]]` takes the same). */
const BLOCK_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
/** Base64, as `Buffer.toString('base64')` writes it. */
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/** What a page is now, as the anchors are found again in it. */
export interface IAnchorContent {
	blocks: IAnchorBlock[];
	live: LiveAnchorResolver | null;
	revision: number;
	/** The approximate-match work left for the anchors found again in it (one read: a list, or one GraphQL request). */
	budget: { cells: number };
}

/**
 * The text-range anchors of a page's comments (`docs-collaboration` plan, §4 "Comment anchors").
 *
 * The comment itself is the platform's (`POST /comment` on entity `Document`, its first line the block marker); its
 * range is kept here, one row per comment, set by the comment's author right after posting it. Every answer finds
 * the anchors again in the page as it is now (`document-comment-anchor.ts`): the live relative positions when the
 * page has a live state, else the offsets, the quote, an approximate quote, and the block.
 *
 * Access is the page's: a caller who may not read the page gets the page route's 404. Only the comment's author sets
 * or removes its anchor, and only while the page takes their comments (the comment API's write rule for a page,
 * `DocumentCommentAccessPolicy.findWritableParent`: a page reached through a `VIEW` share stays read-only). A reply has
 * none (it is on its thread's place).
 *
 * Part of Docs collaboration: while `GAUZY_DOCS_COLLAB_ENABLED` is off the routes answer 404 `DOCS_COLLAB_DISABLED`
 * (a client keeps its threads on their blocks) and `Comment.documentAnchor` is null.
 */
@Injectable()
export class DocumentCommentAnchorService {
	constructor(
		private readonly documents: DocumentService,
		private readonly repository: TypeOrmDocumentCommentAnchorRepository,
		private readonly commentAccess: DocumentCommentAccessPolicy,
		private readonly features: FeatureService
	) {}

	/** The anchors of the page's comments that are still there, each found again in the page as it is now. */
	async list(documentId: ID, organizationId?: ID): Promise<IDocumentCommentAnchorList> {
		assertCollabEnabled();
		const document = await this.documents.findOneScoped(documentId, [], organizationId);
		const rows = await this.repository.find({
			where: { tenantId: document.tenantId as ID, documentId: document.id as ID },
			order: { createdAt: 'ASC' }
		});
		const alive = await this.liveCommentIds(document, rows.map((row) => row.commentId));
		const content = this.contentOf(document);
		return {
			documentId: document.id as ID,
			revision: content.revision,
			live: !!content.live,
			items: rows.filter((row) => alive.has(String(row.commentId))).map((row) => this.resolved(row, content))
		};
	}

	/**
	 * The anchor of one comment (the GraphQL `Comment.documentAnchor` field), found again in its page; null without
	 * one, and for a page the caller may not read. `pages` keeps each page read once for the comments of one request.
	 */
	async ofComment(
		comment: { id?: ID; entity?: string; entityId?: ID; tenantId?: ID },
		pages: Map<string, Promise<IAnchorContent | null>> = new Map()
	): Promise<IDocumentCommentAnchorResolved | null> {
		if (!getDocsConfig().collabEnabled || !comment?.id || comment.entity !== BaseEntityEnum.Document || !comment.entityId) {
			return null;
		}
		const tenantId = (comment.tenantId ?? RequestContext.currentTenantId()) as ID;
		const row = await this.repository.findOne({ where: { commentId: comment.id, tenantId } });
		if (!row) {
			return null;
		}
		const key = String(row.documentId);
		if (!pages.has(key)) {
			// The page in its own organization, which the caller must reach (the comment policy's boundary), and where Docs is
			// on: a field resolver runs no guard, so FEATURE_DOCUMENTS is resolved here as the routes' FeatureFlagGuard
			// resolves it (FeatureService, the request's scope; its fallback is the configured toggle, never a blanket yes).
			pages.set(
				key,
				this.assertOrganization(row.organizationId as ID)
					.then(() => this.features.isFeatureEnabled(FeatureEnum.FEATURE_DOCUMENTS))
					.then((enabled) => {
						if (!enabled) throw new NotFoundException();
						return this.documents.findOneScoped(row.documentId, [], row.organizationId as ID);
					})
					.then((document) => this.contentOf(document))
					.catch(() => null)
			);
		}
		const content = await pages.get(key);
		return content ? this.resolved(row, content) : null;
	}

	/**
	 * Sets the anchor of a comment of the page (its author only; a root comment only). The quote is the range's text,
	 * so its length is the range's.
	 */
	async set(documentId: ID, commentId: ID, input: IDocumentCommentAnchorInput, organizationId?: ID): Promise<IDocumentCommentAnchorResolved> {
		assertCollabEnabled();
		const anchor = normaliseAnchorInput(input);
		const document = await this.documents.findOneScoped(documentId, [], organizationId);
		await this.ownRootComment(document, commentId);
		await this.assertTakesComments(document);
		const existing = await this.repository.findOne({ where: { commentId, tenantId: document.tenantId as ID } });
		const row = this.repository.create({
			...(existing ?? {}),
			tenantId: document.tenantId as ID,
			organizationId: document.organizationId as ID,
			commentId,
			documentId: document.id as ID,
			blockId: anchor.blockId,
			startOffset: anchor.start,
			endOffset: anchor.end,
			quote: anchor.quote,
			prefix: anchor.prefix ?? null,
			suffix: anchor.suffix ?? null,
			relativeStart: anchor.relativeStart ?? null,
			relativeEnd: anchor.relativeEnd ?? null
		});
		const saved = await this.repository.save(row);
		return this.resolved(saved, this.contentOf(document));
	}

	/** Removes the anchor of a comment (its author only): the comment is on its block again. */
	async remove(documentId: ID, commentId: ID, organizationId?: ID): Promise<boolean> {
		assertCollabEnabled();
		const document = await this.documents.findOneScoped(documentId, [], organizationId);
		await this.ownRootComment(document, commentId);
		await this.assertTakesComments(document);
		const result = await this.repository.delete({ commentId, tenantId: document.tenantId as ID, documentId: document.id as ID });
		return (result.affected ?? 0) > 0;
	}

	/**
	 * An organization named by the caller (a GraphQL argument, which no DTO checks) must be one they reach: a tenant
	 * admin any of the tenant's, anyone else the organization of their request (`assertCurrentUserBelongsToOrganization`).
	 */
	async assertOrganization(organizationId?: ID | null): Promise<void> {
		if (organizationId) {
			await assertCurrentUserBelongsToOrganization(this.repository.manager, organizationId);
		}
	}

	/**
	 * Refuses a change to an anchor on a page that does not take the caller's comments, by the rule the comment API
	 * applies to posting and editing them (403 `DOCS_COMMENT_ANCHOR_FORBIDDEN`): a page reached only through a `VIEW`
	 * share is read-only, also for the anchors of comments written before the share was lowered.
	 */
	private async assertTakesComments(document: Document): Promise<void> {
		if (!(await this.commentAccess.findWritableParent(document.id as ID))) {
			throw new ForbiddenException({ message: 'This page does not take your comments', code: DOCS_COMMENT_ANCHOR_FORBIDDEN });
		}
	}

	/** The comment, when it is a root comment of the page written by the caller. */
	private async ownRootComment(document: Document, commentId: ID): Promise<Comment> {
		const comment = await this.repository.manager.findOne(Comment, {
			select: { id: true, parentId: true, employeeId: true, createdByUserId: true },
			where: { id: commentId, tenantId: document.tenantId as ID, entity: BaseEntityEnum.Document, entityId: document.id as ID }
		});
		if (!comment) {
			throw new NotFoundException({ message: 'The comment is not one of this page', code: DOCS_COMMENT_NOT_FOUND });
		}
		if (comment.parentId) {
			throw new BadRequestException({ message: 'A reply is on its thread\'s place and has no anchor of its own', code: DOCS_COMMENT_ANCHOR_REPLY });
		}
		if (!isCallerAuthor(comment)) {
			throw new ForbiddenException({ message: 'Only the author of a comment places it', code: DOCS_COMMENT_ANCHOR_FORBIDDEN });
		}
		return comment;
	}

	/** The ids among `commentIds` of comments of the page that are not withdrawn. */
	private async liveCommentIds(document: Document, commentIds: ID[]): Promise<Set<string>> {
		if (!commentIds.length) {
			return new Set();
		}
		const comments = await this.repository.manager.find(Comment, {
			select: { id: true },
			where: { id: In(commentIds), tenantId: document.tenantId as ID, entity: BaseEntityEnum.Document, entityId: document.id as ID }
		});
		return new Set(comments.map((comment) => String(comment.id)));
	}

	/** The page's blocks, from its live state when it has one for its revision (with the relative positions), else its JSON. */
	private contentOf(document: Document): IAnchorContent {
		const revision = liveRevisionOf(document.contentRevision);
		const state = document.contentBinary ? decodeLiveState(document.contentBinary) : null;
		// A live state of an earlier revision is behind the JSON a save wrote since: the JSON is the page then.
		if (state && state.meta.revision === revision) {
			return { blocks: anchorBlocksOf(liveDocumentJson(state.doc)), live: liveAnchorResolverOf(state.doc), revision, budget: { cells: DOCS_ANCHOR_FUZZY_BUDGET } };
		}
		state?.doc.destroy();
		return { blocks: anchorBlocksOf(document.contentJson), live: null, revision, budget: { cells: DOCS_ANCHOR_FUZZY_BUDGET } };
	}

	private resolved(row: DocumentCommentAnchor, content: IAnchorContent): IDocumentCommentAnchorResolved {
		const anchor = anchorOfRow(row);
		return { ...anchor, position: resolveCommentAnchor(anchor, content.blocks, content.live, content.budget) };
	}
}

/** 404 `DOCS_COLLAB_DISABLED` while Docs collaboration is off (the routes are not there). */
function assertCollabEnabled(): void {
	if (!getDocsConfig().collabEnabled) {
		throw new NotFoundException({ message: 'Docs collaboration is not enabled on this installation', code: DOCS_COLLAB_DISABLED });
	}
}

/** The anchor a row stores, as the API states it. */
export function anchorOfRow(row: DocumentCommentAnchor): IDocumentCommentAnchor {
	return {
		id: row.id as ID,
		commentId: row.commentId,
		documentId: row.documentId,
		tenantId: row.tenantId as ID,
		organizationId: row.organizationId as ID,
		blockId: row.blockId,
		start: Number(row.startOffset),
		end: Number(row.endOffset),
		quote: row.quote,
		prefix: row.prefix ?? null,
		suffix: row.suffix ?? null,
		relativeStart: row.relativeStart ?? null,
		relativeEnd: row.relativeEnd ?? null,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

/**
 * An anchor as it may be stored: a block id the editors write, `0 <= start <= end`, the quote the range's text (its
 * length the range's, at most {@link DOCS_ANCHOR_QUOTE_MAX_LENGTH}), the context at most
 * {@link DOCS_ANCHOR_CONTEXT_MAX_LENGTH} characters a side, the relative positions base64 of a bounded size, both or
 * neither. Anything else is 400 `DOCS_COMMENT_ANCHOR_INVALID`.
 */
export function normaliseAnchorInput(input: IDocumentCommentAnchorInput | null | undefined): Required<IDocumentCommentAnchorInput> {
	const invalid = (reason: string): never => {
		throw new BadRequestException({ message: `Invalid comment anchor: ${reason}`, code: DOCS_COMMENT_ANCHOR_INVALID });
	};
	if (!input || typeof input !== 'object') invalid('no anchor');
	const blockId = String(input!.blockId ?? '');
	if (!BLOCK_ID_PATTERN.test(blockId)) invalid('blockId');
	const start = Number(input!.start);
	const end = Number(input!.end);
	if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) invalid('start / end');
	const quote = typeof input!.quote === 'string' ? input!.quote : invalid('quote');
	if ((quote as string).length > DOCS_ANCHOR_QUOTE_MAX_LENGTH) invalid(`the quote is longer than ${DOCS_ANCHOR_QUOTE_MAX_LENGTH} characters`);
	if ((quote as string).length !== end - start) invalid('the quote is not as long as the range');
	const context = (value: unknown, name: string): string | null => {
		if (value === null || value === undefined || value === '') return null;
		if (typeof value !== 'string' || value.length > DOCS_ANCHOR_CONTEXT_MAX_LENGTH) return invalid(name);
		return value;
	};
	const relative = (value: unknown, name: string): string | null => {
		if (value === null || value === undefined || value === '') return null;
		if (typeof value !== 'string' || value.length > DOCS_ANCHOR_RELATIVE_MAX_LENGTH || !BASE64_PATTERN.test(value)) return invalid(name);
		return value;
	};
	const relativeStart = relative(input!.relativeStart, 'relativeStart');
	const relativeEnd = relative(input!.relativeEnd, 'relativeEnd');
	if (!relativeStart !== !relativeEnd) invalid('relativeStart and relativeEnd go together');
	return {
		blockId,
		start,
		end,
		quote: quote as string,
		prefix: context(input!.prefix, 'prefix'),
		suffix: context(input!.suffix, 'suffix'),
		relativeStart,
		relativeEnd
	};
}

/** The caller's user and employee, or null outside a request. */
function callerIdentity(): { userId: ID | null; employeeId: ID | null } | null {
	try {
		return {
			userId: (RequestContext.currentUserId() as ID) ?? null,
			employeeId: (RequestContext.currentUser()?.employeeId as ID) ?? null
		};
	} catch {
		return null;
	}
}

/** Whether the caller wrote the comment: their employee is its author, or their user posted it. */
function isCallerAuthor(comment: Pick<Comment, 'employeeId' | 'createdByUserId'>): boolean {
	const caller = callerIdentity();
	if (!caller) return false;
	const { userId, employeeId } = caller;
	if (employeeId && comment.employeeId && String(comment.employeeId) === String(employeeId)) return true;
	return !!userId && !!comment.createdByUserId && String(comment.createdByUserId) === String(userId);
}
