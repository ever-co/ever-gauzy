import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { NbToastrService } from '@nebular/theme';
import {
	IGoalTemplate,
	IKeyResultTemplate,
	IGoalKPITemplate
} from '@gauzy/models';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

interface IGoalTemplateResponse {
	items: IGoalTemplate[];
	count: number;
}

@Injectable({
	providedIn: 'root'
})
export class GoalTemplatesService {
	private readonly GOAL_URL = '/api/goal-templates';
	private readonly KEYRESULT_URL = '/api/key-result-templates';
	private readonly GOAL_KPI_URL = '/api/goal-kpi-templates';

	constructor(
		private _http: HttpClient,
		private toastrService: NbToastrService
	) {}

	createGoalTemplate(goalTemplate): Promise<IGoalTemplate> {
		return this._http
			.post<IGoalTemplate>(`${this.GOAL_URL}/create`, goalTemplate)
			.pipe(catchError((error) => this.errorHandler(error)))
			.toPromise();
	}

	createKeyResultTemplate(keyResultTemplate): Promise<IKeyResultTemplate> {
		return this._http
			.post<IKeyResultTemplate>(
				`${this.KEYRESULT_URL}/create`,
				keyResultTemplate
			)
			.pipe(catchError((error) => this.errorHandler(error)))
			.toPromise();
	}

	createGoalKpiTemplate(goalKpiTemplate): Promise<IGoalKPITemplate> {
		return this._http
			.post<IGoalKPITemplate>(
				`${this.GOAL_KPI_URL}/create`,
				goalKpiTemplate
			)
			.pipe(catchError((error) => this.errorHandler(error)))
			.toPromise();
	}

	getAllGoalTemplates(): Promise<IGoalTemplateResponse> {
		return this._http
			.get<IGoalTemplateResponse>(`${this.GOAL_URL}/all`)
			.pipe(catchError((error) => this.errorHandler(error)))
			.toPromise();
	}

	errorHandler(error: HttpErrorResponse) {
		this.toastrService.danger(error.message, 'Error');
		return throwError(error.message);
	}
}
