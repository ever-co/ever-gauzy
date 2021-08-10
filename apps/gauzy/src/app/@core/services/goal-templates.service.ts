import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
	IGoalTemplate,
	IKeyResultTemplate,
	IGoalKPITemplate,
	IGoalTemplateFind
} from '@gauzy/contracts';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { ToastrService } from './toastr.service';
import { API_PREFIX } from '../constants/app.constants';

interface IGoalTemplateResponse {
	items: IGoalTemplate[];
	count: number;
}

@Injectable({
	providedIn: 'root'
})
export class GoalTemplatesService {
	private readonly GOAL_URL = `${API_PREFIX}/goal-templates`;
	private readonly KEYRESULT_URL = `${API_PREFIX}/key-result-templates`;
	private readonly GOAL_KPI_URL = `${API_PREFIX}/goal-kpi-template`;

	constructor(
		private _http: HttpClient,
		private toastrService: ToastrService
	) {}

	createGoalTemplate(goalTemplate): Promise<IGoalTemplate> {
		return this._http
			.post<IGoalTemplate>(`${this.GOAL_URL}`, goalTemplate)
			.pipe(catchError((error) => this.errorHandler(error)))
			.toPromise();
	}

	createKeyResultTemplate(keyResultTemplate): Promise<IKeyResultTemplate> {
		return this._http
			.post<IKeyResultTemplate>(
				`${this.KEYRESULT_URL}`,
				keyResultTemplate
			)
			.pipe(catchError((error) => this.errorHandler(error)))
			.toPromise();
	}

	createGoalKpiTemplate(goalKpiTemplate): Promise<IGoalKPITemplate> {
		return this._http
			.post<IGoalKPITemplate>(
				`${this.GOAL_KPI_URL}`,
				goalKpiTemplate
			)
			.pipe(catchError((error) => this.errorHandler(error)))
			.toPromise();
	}

	getAllGoalTemplates(
		findInput?: IGoalTemplateFind
	): Promise<IGoalTemplateResponse> {
		const data = JSON.stringify({ findInput });
		return this._http
			.get<IGoalTemplateResponse>(`${this.GOAL_URL}`, {
				params: { data }
			})
			.pipe(catchError((error) => this.errorHandler(error)))
			.toPromise();
	}

	errorHandler(error: HttpErrorResponse) {
		this.toastrService.danger(error.message, 'Error');
		return throwError(error.message);
	}
}
