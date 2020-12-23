import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import {
	ITask,
	IGetTaskOptions,
	IGetTaskByEmployeeOptions
} from '@gauzy/models';
import { tap, catchError, first } from 'rxjs/operators';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { toParams } from '@gauzy/utils';
import { ToastrService } from './toastr.service';

interface ITaskResponse {
	items: ITask[];
	count: number;
}

@Injectable({
	providedIn: 'root'
})
export class TasksService extends TranslationBaseComponent {
	private readonly API_URL = '/api/tasks';

	constructor(
		private _http: HttpClient,
		private toastrService: ToastrService,
		public translateService: TranslateService
	) {
		super(translateService);
	}

	getAllTasks(findInput: IGetTaskOptions = {}): Observable<ITaskResponse> {
		const data = JSON.stringify({
			relations: [
				'project',
				'tags',
				'members',
				'members.user',
				'teams',
				'creator',
				'organizationSprint'
			],
			findInput
		});
		return this._http
			.get<ITaskResponse>(this.API_URL, {
				params: { data }
			})
			.pipe(catchError((error) => this.errorHandler(error)));
	}

	getAllTasksByEmployee(id, findInput: IGetTaskByEmployeeOptions = {}) {
		const data = toParams(findInput);
		return this._http
			.get<ITask[]>(`${this.API_URL}/employee/${id}`, {
				params: data
			})
			.pipe(catchError((error) => this.errorHandler(error)))
			.toPromise();
	}

	getMyTasks(findInput: IGetTaskOptions = {}): Observable<ITaskResponse> {
		const data = JSON.stringify({
			findInput
		});
		return this._http
			.get<ITaskResponse>(`${this.API_URL}/me`, {
				params: { data }
			})
			.pipe(catchError((error) => this.errorHandler(error)));
	}

	getTeamTasks(
		findInput: IGetTaskOptions = {},
		employeeId = ''
	): Observable<ITaskResponse> {
		const data = JSON.stringify({
			relations: ['project', 'tags', 'members', 'members.user', 'teams'],
			findInput,
			employeeId
		});
		return this._http
			.get<ITaskResponse>(`${this.API_URL}/team`, {
				params: { data }
			})
			.pipe(catchError((error) => this.errorHandler(error)));
	}

	getById(id: string) {
		return this._http
			.get<ITask>(`${this.API_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	createTask(task): Observable<ITask> {
		return this._http.post<ITask>(this.API_URL, task).pipe(
			tap(() => this.toastrService.success('TASKS_PAGE.TASK_ADDED')),
			catchError((error) => this.errorHandler(error))
		);
	}

	editTask(task: ITask): Observable<ITask> {
		return this._http.put<ITask>(`${this.API_URL}/${task.id}`, task).pipe(
			tap(() => this.toastrService.success('TASKS_PAGE.TASK_UPDATED')),
			catchError((error) => this.errorHandler(error))
		);
	}

	deleteTask(id: string): Observable<void> {
		return this._http.delete<void>(`${this.API_URL}/${id}`).pipe(
			tap(() => this.toastrService.success('TASKS_PAGE.TASK_DELETED')),
			catchError((error) => this.errorHandler(error))
		);
	}

	errorHandler(error: HttpErrorResponse) {
		this.toastrService.danger(
			error.message,
			this.getTranslation('TOASTR.TITLE.ERROR')
		);

		return throwError(error.message);
	}
}
