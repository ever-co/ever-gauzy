import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { ITask, IGetTaskOptions, IGetTaskByEmployeeOptions, IPagination, IEmployee } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ToastrService } from '../notification';

@Injectable({
	providedIn: 'root'
})
export class TasksService extends TranslationBaseComponent {
	private readonly API_URL = `${API_PREFIX}/tasks`;

	constructor(
		private readonly _http: HttpClient,
		private readonly toastrService: ToastrService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	getAllTasks(where: IGetTaskOptions, relations: string[] = []): Observable<IPagination<ITask>> {
		return this._http
			.get<IPagination<ITask>>(this.API_URL, {
				params: toParams({ relations, where })
			})
			.pipe(catchError((error) => this.errorHandler(error)));
	}

	getAllTasksByEmployee(id: IEmployee['id'], options: IGetTaskByEmployeeOptions) {
		return firstValueFrom(
			this._http
				.get<ITask[]>(`${this.API_URL}/employee/${id}`, {
					params: toParams(options)
				})
				.pipe(catchError((error) => this.errorHandler(error)))
		);
	}

	getMyTasks(findInput: IGetTaskOptions = {}): Observable<IPagination<ITask>> {
		const data = JSON.stringify({
			findInput
		});
		return this._http
			.get<IPagination<ITask>>(`${this.API_URL}/me`, {
				params: { data }
			})
			.pipe(catchError((error) => this.errorHandler(error)));
	}

	getTeamTasks(findInput: IGetTaskOptions = {}, employeeId = ''): Observable<IPagination<ITask>> {
		const data = JSON.stringify({
			relations: ['project', 'tags', 'members', 'members.user', 'teams'],
			findInput,
			employeeId
		});
		return this._http
			.get<IPagination<ITask>>(`${this.API_URL}/team`, {
				params: { data }
			})
			.pipe(catchError((error) => this.errorHandler(error)));
	}

	getById(id: string) {
		return firstValueFrom(this._http.get<ITask>(`${this.API_URL}/${id}`));
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
		this.toastrService.danger(error.message, this.getTranslation('TOASTR.TITLE.ERROR'));

		return throwError(error.message);
	}

	getMaxTaskNumber(options: IGetTaskOptions): Observable<number> {
		return this._http.get<number>(`${API_PREFIX}/tasks/max-number`, {
			params: toParams(options)
		});
	}
}
