import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ITaskSize } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { CrudService } from '../crud/crud.service';

@Injectable({
	providedIn: 'root'
})
export class TaskSizesService extends CrudService<ITaskSize> {
	static readonly API_URL = `${API_PREFIX}/task-sizes`;

	constructor(http: HttpClient) {
		super(http, TaskSizesService.API_URL);
	}
}
