import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { IGoalTemplate, IKeyResultTemplate, IGoalKPITemplate, IGoalTemplateFind } from '@gauzy/contracts';
import { catchError } from 'rxjs/operators';
import { firstValueFrom, throwError } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-sdk/common';
import { ToastrService } from '@gauzy/ui-sdk/core';

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

	constructor(private _http: HttpClient, private toastrService: ToastrService) {}

	createGoalTemplate(goalTemplate): Promise<IGoalTemplate> {
		return firstValueFrom(
			this._http
				.post<IGoalTemplate>(`${this.GOAL_URL}`, goalTemplate)
				.pipe(catchError((error) => this.errorHandler(error)))
		);
	}

	createKeyResultTemplate(keyResultTemplate): Promise<IKeyResultTemplate> {
		return firstValueFrom(
			this._http
				.post<IKeyResultTemplate>(`${this.KEYRESULT_URL}`, keyResultTemplate)
				.pipe(catchError((error) => this.errorHandler(error)))
		);
	}

	createGoalKpiTemplate(goalKpiTemplate): Promise<IGoalKPITemplate> {
		return firstValueFrom(
			this._http
				.post<IGoalKPITemplate>(`${this.GOAL_KPI_URL}`, goalKpiTemplate)
				.pipe(catchError((error) => this.errorHandler(error)))
		);
	}

	getAllGoalTemplates(findInput?: IGoalTemplateFind): Promise<IGoalTemplateResponse> {
		const data = JSON.stringify({ findInput });
		return firstValueFrom(
			this._http
				.get<IGoalTemplateResponse>(`${this.GOAL_URL}`, {
					params: { data }
				})
				.pipe(catchError((error) => this.errorHandler(error)))
		);
	}

	errorHandler(error: HttpErrorResponse) {
		this.toastrService.danger(error.message, 'Error');
		return throwError(error.message);
	}
}
