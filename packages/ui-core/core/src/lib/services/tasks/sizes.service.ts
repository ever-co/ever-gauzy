import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ITaskSize } from '@gauzy/contracts';
import { CrudService } from '../crud/crud.service';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class TaskSizesService extends CrudService<ITaskSize> {
	static readonly API_URL = `${API_PREFIX}/task-sizes`;

	constructor(protected readonly http: HttpClient) {
		super(http, TaskSizesService.API_URL);
	}
}
