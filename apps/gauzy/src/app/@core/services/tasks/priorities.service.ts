import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ITaskPriority } from '@gauzy/contracts';
import { CrudService } from '../crud/crud.service';
import { API_PREFIX } from '../../constants';

@Injectable()
export class TaskPrioritiesService extends CrudService<ITaskPriority> {
	static readonly API_URL = `${API_PREFIX}/task-priorities`;

	constructor(protected readonly http: HttpClient) {
		super(http, TaskPrioritiesService.API_URL);
	}
}
