import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { GoalTimeFrame, GoalFindInput, KPI, KpiFindInput } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { throwError } from 'rxjs';
import { catchError, tap, first } from 'rxjs/operators';

interface IGoalTimeFrameResponse {
	items: GoalTimeFrame[];
	count: number;
}

interface IKpiResponse {
	items: KPI[];
	count: number;
}

@Injectable({
	providedIn: 'root'
})
export class GoalSettingsService {
	private readonly TIME_FRAME_URL = '/api/goal-time-frame';
	private readonly KPI_URL = '/api/goal-kpi';
	constructor(
		private _http: HttpClient,
		private toastrService: NbToastrService
	) {}

	// Goal Time Frame
	createTimeFrame(timeFrame): Promise<GoalTimeFrame> {
		return this._http
			.post<GoalTimeFrame>(`${this.TIME_FRAME_URL}/create`, timeFrame)
			.pipe(
				tap(() =>
					this.toastrService.primary('Time Frame Created', 'Success')
				),
				catchError((error) => this.errorHandler(error))
			)
			.toPromise();
	}

	getAllTimeFrames(
		findInput: GoalFindInput
	): Promise<IGoalTimeFrameResponse> {
		const data = JSON.stringify({ findInput });
		return this._http
			.get<IGoalTimeFrameResponse>(`${this.TIME_FRAME_URL}/all`, {
				params: { data }
			})
			.pipe(catchError((error) => this.errorHandler(error)))
			.toPromise();
	}

	deleteTimeFrame(id: string): Promise<any> {
		return this._http
			.delete(`${this.TIME_FRAME_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	getTimeFrameByName(name: string): Promise<IGoalTimeFrameResponse> {
		return this._http
			.get<IGoalTimeFrameResponse>(`${this.TIME_FRAME_URL}/${name}`)
			.pipe(catchError((error) => this.errorHandler(error)))
			.toPromise();
	}

	updateTimeFrame(
		id: string,
		goalTimeFrame: GoalTimeFrame
	): Promise<GoalTimeFrame> {
		return this._http
			.put<GoalTimeFrame>(`${this.TIME_FRAME_URL}/${id}`, goalTimeFrame)
			.pipe(
				tap(() =>
					this.toastrService.primary('Time Frame Updated', 'Success')
				)
			)
			.toPromise();
	}

	// KPI
	createKPI(kpi): Promise<KPI> {
		return this._http
			.post<KPI>(`${this.KPI_URL}/create`, kpi)
			.pipe(
				tap(() => this.toastrService.primary('KPI Created', 'Success')),
				catchError((error) => this.errorHandler(error))
			)
			.toPromise();
	}

	getAllKPI(findInput?: KpiFindInput): Promise<IKpiResponse> {
		const data = JSON.stringify({ findInput });
		return this._http
			.get<IKpiResponse>(`${this.KPI_URL}/all`, {
				params: { data }
			})
			.pipe(catchError((error) => this.errorHandler(error)))
			.toPromise();
	}

	deleteKPI(id: string): Promise<any> {
		return this._http
			.delete(`${this.KPI_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	updateKPI(id: string, kpiData: KPI): Promise<KPI> {
		return this._http
			.put<KPI>(`${this.KPI_URL}/${id}`, kpiData)
			.pipe(
				tap(() => this.toastrService.primary('KPI Updated', 'Success'))
			)
			.toPromise();
	}

	errorHandler(error: HttpErrorResponse) {
		this.toastrService.danger(error.message, 'Error');
		return throwError(error.message);
	}
}
