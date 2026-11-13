import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
	BaseEntityEnum,
	IComment,
	ICommentCreateInput,
	ICommentUpdateInput,
	ID,
	IDocumentCommentAnchorInput,
	IDocumentCommentAnchorList,
	IDocumentCommentAnchorResolved,
	IPagination
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';

/** Author identity + the user block behind it — everything a comment row renders. */
const COMMENT_RELATIONS = ['employee', 'employee.user'];

/** `PaginationQueryDTO.take` is `@Max(100)`; asking for more is a 400, not a bigger page. */
export const COMMENTS_PAGE_SIZE = 100;

/**
 * Client for the platform's generic comment API (`/api/comment`), bound to
 * `(BaseEntityEnum.Document, documentId)`.
 *
 * Documents contributes no comment endpoints of its own — `BaseEntityEnum.Document`
 * is the whole integration (spec 08 §1), so threading, mentions, resolve and the
 * notification fan-out all come from `CommentService`.
 *
 * 🛑 `BaseQueryDTO.where` is `@IsNotEmpty()` and the controller runs under
 * `ValidationPipe`, so the filter must always carry the tenant/organization
 * scope alongside the entity keys — an empty `where` is a 400 that blanks the
 * thread rather than showing it unscoped.
 */
@Injectable()
export class DocumentCommentsService {
	private readonly API_URL = `${API_PREFIX}/comment`;
	private readonly DOCS_URL = `${API_PREFIX}/plugins/docs/documents`;

	constructor(private readonly http: HttpClient, private readonly store: Store) {}

	/**
	 * One page of comments for a document, oldest first.
	 *
	 * Replies are NOT requested as a relation: they are ordinary rows of the same
	 * entity, so the page already contains them and `buildCommentThread()` groups
	 * them client-side. Asking for `replies` as well would return each reply twice
	 * and make "how many comments are there" ambiguous.
	 */
	getAll(documentId: ID): Observable<IPagination<IComment>> {
		return this.http.get<IPagination<IComment>>(this.API_URL, {
			params: toParams({
				where: {
					entity: BaseEntityEnum.Document,
					entityId: documentId,
					...this.orgContext()
				},
				relations: COMMENT_RELATIONS,
				order: { createdAt: 'ASC' },
				take: COMMENTS_PAGE_SIZE
			})
		});
	}

	/**
	 * Posts a comment or a reply (`parentId`).
	 *
	 * `employeeId` is intentionally NOT sent: `CommentService.create()` takes the
	 * author from `RequestContext.currentEmployeeId()` and only falls back to the
	 * body, so sending one would let a client attribute a comment to someone else.
	 */
	create(input: ICommentCreateInput): Observable<IComment> {
		return this.http.post<IComment>(this.API_URL, { ...this.orgContext(), ...input });
	}

	/**
	 * Edits / resolves a comment.
	 *
	 * 🛑 The server-side update matches on `{ id, employeeId: currentEmployee }` —
	 * every field of this call, `resolved` included, is author-only. The UI must
	 * gate on authorship rather than on a `DOCS_*` permission or the request comes
	 * back 400 "Comment update failed".
	 */
	update(id: ID, input: ICommentUpdateInput): Observable<IComment> {
		return this.http.put<IComment>(`${this.API_URL}/${id}`, input);
	}

	delete(id: ID): Observable<unknown> {
		return this.http.delete(`${this.API_URL}/${id}`);
	}

	// ─── Ranges (`docs-collaboration` FR-16; 404 `DOCS_COLLAB_DISABLED` while it is off) ─

	/**
	 * The text ranges of the page's comments, each found again by the platform in the page as it is saved (or live).
	 *
	 * 🛑 A platform without ranges (an older one, or `GAUZY_DOCS_COLLAB_ENABLED` off) answers 404: every caller keeps
	 * the threads on their blocks (their `[[block:…]]` first line) then.
	 */
	anchors(documentId: ID): Observable<IDocumentCommentAnchorList> {
		return this.http.get<IDocumentCommentAnchorList>(`${this.DOCS_URL}/${documentId}/comment-anchors`, {
			params: toParams(this.definedOrgContext())
		});
	}

	/**
	 * Stores the range a thread was made on (its first comment, by its author, right after posting it): the block, the
	 * offsets into the block's text, the quote, a little context and, live, the ends as relative positions.
	 *
	 * 🛑 The caller reads the refusals: 404 without a code (an older platform) or `DOCS_COLLAB_DISABLED` means the
	 * platform keeps no ranges; 404 `DOCS_COMMENT_NOT_FOUND` names a comment that is not the page's; 403 a page that
	 * takes no comments from the caller (a view share) or a comment of someone else. None of them undoes the comment,
	 * which stays on its block.
	 */
	setAnchor(
		documentId: ID,
		commentId: ID,
		input: IDocumentCommentAnchorInput
	): Observable<IDocumentCommentAnchorResolved> {
		return this.http.put<IDocumentCommentAnchorResolved>(
			`${this.DOCS_URL}/${documentId}/comments/${commentId}/anchor`,
			// The scope last: the selected organization, never a value the anchor carries.
			{
				...input,
				...this.definedOrgContext()
			}
		);
	}

	/** The scope without absent values: `toParams()` would send `undefined` as the text "undefined". */
	private definedOrgContext(): { organizationId?: ID; tenantId?: ID } {
		const { organizationId, tenantId } = this.orgContext();
		return { ...(organizationId ? { organizationId } : {}), ...(tenantId ? { tenantId } : {}) };
	}

	/** Tenant/organization scope from the selected organization, as every Documents call does. */
	private orgContext(): { organizationId?: ID; tenantId?: ID } {
		const organization = this.store.selectedOrganization;
		return organization ? { organizationId: organization.id as ID, tenantId: organization.tenantId as ID } : {};
	}
}
