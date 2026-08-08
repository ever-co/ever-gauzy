import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
	BaseEntityEnum,
	IComment,
	ICommentCreateInput,
	ICommentUpdateInput,
	ID,
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

	/** Tenant/organization scope from the selected organization, as every Documents call does. */
	private orgContext(): { organizationId?: ID; tenantId?: ID } {
		const organization = this.store.selectedOrganization;
		return organization ? { organizationId: organization.id as ID, tenantId: organization.tenantId as ID } : {};
	}
}
