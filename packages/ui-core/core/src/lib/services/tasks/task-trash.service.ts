import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ID, IPagination, ITask, ITaskTrashFindInput } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

/** A page of the trash: the platform serves at most 100. */
export const TASK_TRASH_PAGE_SIZE = 50;

/** The longest search the platform takes (`TaskTrashQueryDTO.search`): a longer one is a 400. */
export const TASK_TRASH_SEARCH_MAX_LENGTH = 200;

/** A trashed task as the trash answers it: the task, with when and by whom it was deleted. */
export type ITrashedTask = ITask & {
	/** The key the lists show (`API-42`), where the platform states it. */
	taskNumber?: string;
	deletedAt?: Date | string;
	deletedByUser?: { firstName?: string; lastName?: string; name?: string } | null;
};

/**
 * Client for the task trash (`GET /api/tasks/trash`, behind the platform's `GAUZY_TASK_TRASH_ENABLED`): its list,
 * moving a task there (`DELETE /api/tasks/:id/soft`), restoring it (`PUT /api/tasks/:id/recover`) and deleting it for
 * good while it is still there (`DELETE /api/tasks/:id/trashed`). Whether the platform keeps a trash is learned once
 * per organization, from one read of the list: 404 means no trash, and deletes stay permanent.
 */
@Injectable({
	providedIn: 'root'
})
export class TaskTrashService {
	private readonly API_URL = `${API_PREFIX}/tasks`;
	private readonly _enabled = new Map<ID, Promise<boolean>>();

	constructor(private readonly _http: HttpClient) {}

	/**
	 * Whether the platform keeps a trash for this organization's tasks: the list answers (a 403 too: the reader may
	 * not list it, but it is kept). 404 says the trash is off, and a platform without the route answers 400 (its
	 * `/tasks/:id` read): both are remembered as no trash.
	 *
	 * Any other failure (no network, a timeout, a 5xx) is no answer: it is not remembered and the promise rejects
	 * with it, so a delete that asked stops instead of deleting a task for good where the platform keeps a trash. The
	 * header link reads that as no link (see {@link isEnabledOrFalse}).
	 */
	isEnabled(organizationId: ID | null | undefined, tenantId?: ID | null): Promise<boolean> {
		if (!organizationId) return Promise.resolve(false);
		let probe = this._enabled.get(organizationId);
		if (!probe) {
			probe = firstValueFrom(
				this._http.get(`${this.API_URL}/trash`, {
					params: toParams({ organizationId, ...(tenantId ? { tenantId } : {}), take: 1 })
				})
			)
				.then(() => true)
				.catch((error: HttpErrorResponse) => {
					if (error?.status === 404 || error?.status === 400) return false;
					// Forbidden is still a trash (the reader may not list it); anything else is asked again later.
					if (error?.status === 403) return true;
					this._enabled.delete(organizationId);
					throw error;
				});
			this._enabled.set(organizationId, probe);
		}
		return probe;
	}

	/** {@link isEnabled}, with no answer read as no trash: for what only decides whether to show a link. */
	isEnabledOrFalse(organizationId: ID | null | undefined, tenantId?: ID | null): Promise<boolean> {
		return this.isEnabled(organizationId, tenantId).catch(() => false);
	}

	/** A page of the organization's trash (optionally of one project), most recently deleted first. */
	list(input: ITaskTrashFindInput): Promise<IPagination<ITrashedTask>> {
		const { organizationId, tenantId, projectId, organizationTeamId, search, skip = 0, take = TASK_TRASH_PAGE_SIZE } = input;
		return firstValueFrom(
			this._http.get<IPagination<ITrashedTask>>(`${this.API_URL}/trash`, {
				params: toParams({
					organizationId,
					...(tenantId ? { tenantId } : {}),
					...(projectId ? { projectId } : {}),
					...(organizationTeamId ? { organizationTeamId } : {}),
					// A title, a number (`42`, `#42`) or a key (`API-42`), within the platform's 200 characters.
					...(search?.trim() ? { search: search.trim().slice(0, TASK_TRASH_SEARCH_MAX_LENGTH) } : {}),
					skip,
					take
				})
			})
		);
	}

	/** Moves a task to the trash. */
	moveToTrash(id: ID): Promise<unknown> {
		return firstValueFrom(this._http.delete(`${this.API_URL}/${id}/soft`));
	}

	/** Brings a task back from the trash. */
	restore(id: ID): Promise<unknown> {
		return firstValueFrom(this._http.put(`${this.API_URL}/${id}/recover`, {}));
	}

	/**
	 * Deletes a task for good, only while it is in the organization's trash: it cannot be restored afterwards. A task
	 * someone restored (or deleted) since the trash was read is left alone, and the promise rejects with a 404
	 * (`DELETE /api/tasks/:id` would delete a restored, live task).
	 */
	deleteForever(id: ID, organizationId: ID, tenantId?: ID | null): Promise<unknown> {
		return firstValueFrom(
			this._http.delete(`${this.API_URL}/${id}/trashed`, {
				params: toParams({ organizationId, ...(tenantId ? { tenantId } : {}) })
			})
		);
	}
}
