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
	 * All of a record's comments with their authors (the employee, and the user who posted it, for a comment
	 * posted without an employee), oldest first, read page by page: one page stops at
	 * `COMMENTS_PAGE_SIZE`, and with the oldest first, a single page would leave out the newest comments.
	 *
	 * The scope travels in `where` as well as the entity keys: `BaseQueryDTO.where` is `@IsNotEmpty()`, and
	 * the tenant/organization keep the lookup on the caller's own records.
	 */
	async getAll(entity: BaseEntityEnum, entityId: ID, scope: ICommentScope): Promise<IPagination<IComment>> {
		const items: IComment[] = [];
		let total = 0;
		do {
			const page = await firstValueFrom(
				this._http.get<IPagination<IComment>>(this.API_URL, {
					params: toParams({
						where: { entity, entityId, ...scope },
						relations: ['employee', 'employee.user', 'createdByUser'],
						order: { createdAt: 'ASC' },
						take: COMMENTS_PAGE_SIZE,
						// A row offset on `GET /comment` (`findAll`), not a page number.
						skip: items.length
					})
				})
			);
			total = page.total;
			items.push(...page.items);
			// An empty page ends the read even if `total` says more, so a shrinking list cannot loop forever.
			if (!page.items.length) {
				break;
			}
		} while (items.length < total);
		return { items, total };
	}

	/** How many comments a record has, replies included: one row is read, for the total. */
	async count(entity: BaseEntityEnum, entityId: ID, scope: ICommentScope): Promise<number> {
		const page = await firstValueFrom(
			this._http.get<IPagination<IComment>>(this.API_URL, {
				params: toParams({ where: { entity, entityId, ...scope }, take: 1 })
			})
		);
		return page.total;
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
