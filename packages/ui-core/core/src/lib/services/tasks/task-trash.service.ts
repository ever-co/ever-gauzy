import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ID, IPagination, ITask, ITaskTrashFindInput } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

/** A page of the trash: the platform serves at most 100. */
export const TASK_TRASH_PAGE_SIZE = 50;

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
 * good (`DELETE /api/tasks/:id`). Whether the platform keeps a trash is learned once per organization, from one read
 * of the list: 404 means no trash, and deletes stay permanent.
 */
@Injectable({
	providedIn: 'root'
})
export class TaskTrashService {
	private readonly API_URL = `${API_PREFIX}/tasks`;
	private readonly _enabled = new Map<ID, Promise<boolean>>();

	constructor(private readonly _http: HttpClient) {}

	/**
	 * Whether the platform keeps a trash for this organization's tasks: the list answers (any status but 404). A
	 * failed probe is not remembered, so the next call asks again.
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
					if (error?.status === 404) return false;
					// Forbidden is still a trash (the reader may not list it); anything else is asked again later.
					if (error?.status === 403) return true;
					this._enabled.delete(organizationId);
					return false;
				});
			this._enabled.set(organizationId, probe);
		}
		return probe;
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
					...(search?.trim() ? { search: search.trim() } : {}),
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

	/** Deletes a task for good: it cannot be restored afterwards. */
	deleteForever(id: ID): Promise<unknown> {
		return firstValueFrom(this._http.delete(`${this.API_URL}/${id}`));
	}
}
