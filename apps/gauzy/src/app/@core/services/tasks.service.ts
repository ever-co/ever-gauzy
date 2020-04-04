import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { NbToastrService } from '@nebular/theme';
import { Observable, throwError } from 'rxjs';
import { Task, GetTaskOptions } from '@gauzy/models';
import { tap, catchError } from 'rxjs/operators';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';

interface ITaskResponse {
	items: Task[];
	count: number;
}

@Injectable({
	providedIn: 'root'
})
export class TasksService extends TranslationBaseComponent {
	private readonly API_URL = '/api/tasks';

	constructor(
		private _http: HttpClient,
		private toastrService: NbToastrService,
		public translateService: TranslateService
	) {
		super(translateService);
	}

	getAllTasks(findInput: GetTaskOptions = {}): Observable<ITaskResponse> {
		const data = JSON.stringify({ relations: ['project'], findInput });
		return this._http
			.get<ITaskResponse>(this.API_URL, {
				params: { data }
			})
			.pipe(catchError((error) => this.errorHandler(error)));
	}

	createTask(task): Observable<Task> {
		return this._http.post<Task>(this.API_URL, task).pipe(
			tap(() =>
				this.toastrService.primary(
					this.getTranslation('TASKS_PAGE.TASK_ADDED'),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				)
			),
			catchError((error) => this.errorHandler(error))
		);
	}

	editTask(task: Task): Observable<Task> {
		return this._http.put<Task>(`${this.API_URL}/${task.id}`, task).pipe(
			tap(() =>
				this.toastrService.primary(
					this.getTranslation('TASKS_PAGE.TASK_UPDATED'),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				)
			),
			catchError((error) => this.errorHandler(error))
		);
	}

	deleteTask(id: string): Observable<void> {
		return this._http.delete<void>(`${this.API_URL}/${id}`).pipe(
			tap(() =>
				this.toastrService.primary(
					this.getTranslation('TASKS_PAGE.TASK_DELETED'),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				)
			),
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
