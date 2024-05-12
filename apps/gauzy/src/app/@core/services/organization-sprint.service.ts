import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { ITask, IOrganizationSprint, IGetSprintsOptions } from '@gauzy/contracts';
import { tap, catchError } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { ToastrService } from './toastr.service';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class SprintService extends TranslationBaseComponent {
	private readonly API_URL = `${API_PREFIX}/organization-sprint`;

	constructor(
		private _http: HttpClient,
		private toastrService: ToastrService,
		public translateService: TranslateService
	) {
		super(translateService);
	}

	getAllSprints(findInput: IGetSprintsOptions = {}): Observable<any> {
		const data = JSON.stringify({
			relations: ['tasks'],
			findInput
		});
		return this._http
			.get<any>(this.API_URL, {
				params: { data }
			})
			.pipe(catchError((error) => this.errorHandler(error)));
	}

	getById(id: string) {
		return firstValueFrom(this._http.get<ITask>(`${this.API_URL}/${id}`));
	}

	createSprint(sprint: IOrganizationSprint): Observable<IOrganizationSprint> {
		return this._http.post<IOrganizationSprint>(this.API_URL, sprint).pipe(
			tap(() => {
				this.toastrService.success(this.getTranslation('SPRINTS_PAGE.SPRINT_ADDED'));
			}),
			catchError((error) => this.errorHandler(error))
		);
	}

	editSprint(sprintId: string, sprint: Partial<IOrganizationSprint>): Observable<IOrganizationSprint> {
		return this._http.put<IOrganizationSprint>(`${this.API_URL}/${sprintId}`, sprint).pipe(
			tap(() => this.toastrService.success(this.getTranslation('SPRINTS_PAGE.SPRINT_UPDATED'))),
			catchError((error) => this.errorHandler(error))
		);
	}

	deleteSprint(id: string): Observable<void> {
		return this._http.delete<void>(`${this.API_URL}/${id}`).pipe(
			tap(() => this.toastrService.success(this.getTranslation('SPRINTS_PAGE.SPRINT_DELETED'))),
			catchError((error) => this.errorHandler(error))
		);
	}

	private errorHandler(error: HttpErrorResponse) {
		this.toastrService.danger(error);
		return throwError(error.message);
	}
}
