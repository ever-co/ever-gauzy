import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BaseEntityEnum, IActivityLog, ID, IPagination } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

/** Rows per page of a recent-activity list. The API caps `take` at 100. */
export const ACTIVITY_LOG_PAGE_SIZE = 10;

/** The author and the user behind them: enough for a row to name who did it. */
export const ACTIVITY_LOG_AUTHOR_RELATIONS = ['employee', 'employee.user'];

/** What a page of activity is read by. */
export interface IActivityLogQuery {
	/** Required by the API: a read without it is refused (400), never unscoped. */
	organizationId: ID;
	tenantId?: ID;
	/** Only this kind of record (tasks, projects…); every kind without it. */
	entity?: BaseEntityEnum;
	/** Only this record. */
	entityId?: ID;
	/** The page, from 1. */
	page?: number;
	/** Rows per page; {@link ACTIVITY_LOG_PAGE_SIZE} without it. */
	take?: number;
	relations?: string[];
}

/**
 * Client for the platform's activity log (`GET /api/activity-log`), newest first.
 *
 * The API decides what a caller sees: someone who may not change the selected employee reads only their
 * own activity. Two things about its query shape this client takes care of:
 *
 * - `skip` is a 1-based page number, not an offset (`ActivityLogService.findActivityLogs()` computes
 *   `take * (skip - 1)`), so it is sent as the page.
 * - Absent filters are left out rather than sent as the string `"undefined"`, which the API would reject.
 */
@Injectable({
	providedIn: 'root'
})
export class ActivityLogService {
	private readonly API_URL = `${API_PREFIX}/activity-log`;

	constructor(private readonly _http: HttpClient) {}

	/**
	 * One page of activity, newest first.
	 *
	 * @param query The organization, the optional record filters and the page.
	 * @returns The page's rows; `total` counts every matching row.
	 */
	getPage(query: IActivityLogQuery): Promise<IPagination<IActivityLog>> {
		const {
			organizationId,
			tenantId,
			entity,
			entityId,
			page = 1,
			take = ACTIVITY_LOG_PAGE_SIZE,
			relations = ACTIVITY_LOG_AUTHOR_RELATIONS
		} = query;
		return firstValueFrom(
			this._http.get<IPagination<IActivityLog>>(this.API_URL, {
				params: toParams({
					organizationId,
					...(tenantId ? { tenantId } : {}),
					...(entity ? { entity } : {}),
					...(entityId ? { entityId } : {}),
					orderBy: 'createdAt',
					order: 'DESC',
					...(relations.length ? { relations } : {}),
					take,
					skip: Math.max(1, Math.trunc(page) || 1)
				})
			})
		);
	}
}
