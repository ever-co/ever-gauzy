
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, shareReplay, firstValueFrom } from 'rxjs';
import { TaskStatusCacheService, Store } from '../../services';
import {
	IPagination,
	ITaskStatus
} from '@gauzy/contracts';
import { API_PREFIX } from '../../constants';
import { toParams } from '@gauzy/ui-core/common';

@Injectable({ providedIn: 'root' })
export class TasksService {
	constructor(
		private _taskStatusCacheService: TaskStatusCacheService,
		private _store: Store,
		private http: HttpClient
	) {}

	public async loadTaskStatus(): Promise<void> {
		this._store.statuses = await this.getTaskStatus();
	}

	public async getTaskStatus(): Promise<ITaskStatus[]> {
		const tenantId = this._store.tenantId;
		const organizationId = this._store.organizationId;
		const params = {
			tenantId,
			organizationId
		}
		let taskStatuses$ = this._taskStatusCacheService.getValue(params);
		if (!taskStatuses$) {
			taskStatuses$ = this.http
				.get<IPagination<ITaskStatus>>(`${API_PREFIX}/task-statuses`, {
					params: toParams({ ...params })
				})
				.pipe(
					map((res) => res.items),
					shareReplay(1)
				);
			this._taskStatusCacheService.setValue(taskStatuses$, params);
		}
		return firstValueFrom(taskStatuses$);
	}
}




