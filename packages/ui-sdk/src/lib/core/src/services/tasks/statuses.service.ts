import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ITaskStatus } from '@gauzy/contracts';
import { CrudService } from '../crud/crud.service';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable({
	providedIn: 'root'
})
export class TaskStatusesService extends CrudService<ITaskStatus> {
	static readonly API_URL = `${API_PREFIX}/task-statuses`;

	constructor(protected readonly http: HttpClient) {
		super(http, TaskStatusesService.API_URL);
	}
}
