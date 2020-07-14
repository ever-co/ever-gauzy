import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { NbToastrService } from '@nebular/theme';
import { Observable, throwError } from 'rxjs';
import { Task, GetTaskOptions, OrganizationSprint } from '@gauzy/models';
import { tap, catchError, first } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';

interface ITaskResponse {
	items: Task[];
	count: number;
}

@Injectable({
	providedIn: 'root'
})
export class SprintService extends TranslationBaseComponent {
	private readonly API_URL = '/api/organization-sprint';

	constructor(
		private _http: HttpClient,
		private toastrService: NbToastrService,
		public translateService: TranslateService
	) {
		super(translateService);
	}

	getAllSprints(findInput: GetTaskOptions = {}): Observable<ITaskResponse> {
		const data = JSON.stringify({
			relations: [
				'project',
				'tags',
				'members',
				'members.user',
				'teams',
				'creator'
			],
			findInput
		});
		return this._http
			.get<ITaskResponse>(this.API_URL, {
				params: { data }
			})
			.pipe(catchError((error) => this.errorHandler(error)));
	}

	getById(id: string) {
		return this._http
			.get<Task>(`${this.API_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	createSprint(sprint: OrganizationSprint): Observable<OrganizationSprint> {
		return this._http.post<OrganizationSprint>(this.API_URL, sprint).pipe(
			tap((response: any) => {
				console.log(response);
				this.toastrService.primary(
					this.getTranslation('TASKS_PAGE.TASK_ADDED'),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
			}),
			catchError((error) => this.errorHandler(error))
		);
	}

	editSprint(task: Task): Observable<Task> {
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

	deleteSprint(id: string): Observable<void> {
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
