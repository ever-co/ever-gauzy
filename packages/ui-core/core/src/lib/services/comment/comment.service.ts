import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { BaseEntityEnum, IComment, ICommentCreateInput, ID, IPagination } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

/** `PaginationQueryDTO.take` is `@Max(100)`; asking for more is a 400, not a bigger page. */
export const COMMENTS_PAGE_SIZE = 100;

/** The tenant/organization a record's comments are scoped to. */
export interface ICommentScope {
	organizationId?: ID;
	tenantId?: ID;
}

/**
 * Client for the platform's generic comment API (`/api/comment`), where a comment hangs off any record
 * through `(entity, entityId)`.
 */
@Injectable({
	providedIn: 'root'
})
export class CommentService {
	private readonly API_URL = `${API_PREFIX}/comment`;

	constructor(private readonly _http: HttpClient) {}

	/**
	 * One page of a record's comments with their authors, oldest first.
	 *
	 * The scope travels in `where` as well as the entity keys: `BaseQueryDTO.where` is `@IsNotEmpty()`, and
	 * the tenant/organization keep the lookup on the caller's own records.
	 */
	getAll(entity: BaseEntityEnum, entityId: ID, scope: ICommentScope): Promise<IPagination<IComment>> {
		return firstValueFrom(
			this._http.get<IPagination<IComment>>(this.API_URL, {
				params: toParams({
					where: { entity, entityId, ...scope },
					relations: ['employee', 'employee.user'],
					order: { createdAt: 'ASC' },
					take: COMMENTS_PAGE_SIZE
				})
			})
		);
	}

	/**
	 * Posts a comment. `employeeId` is not sent: the server takes the author from the request context, so a
	 * client cannot attribute a comment to someone else.
	 */
	create(input: ICommentCreateInput): Promise<IComment> {
		return firstValueFrom(this._http.post<IComment>(this.API_URL, input));
	}

	delete(id: ID): Promise<unknown> {
		return firstValueFrom(this._http.delete(`${this.API_URL}/${id}`));
	}
}
