import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { GoalTimeFrame } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { throwError } from 'rxjs';
import { catchError, tap, first } from 'rxjs/operators';

interface IGoalTimeFrameResponse {
	items: GoalTimeFrame[];
	count: number;
}

@Injectable({
	providedIn: 'root'
})
export class GoalSettingsService {
	private readonly TIME_FRAME_URL = '/api/goal-time-frame';
	constructor(
		private _http: HttpClient,
		private toastrService: NbToastrService
	) {}

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

	getAllTimeFrames(): Promise<IGoalTimeFrameResponse> {
		return this._http
			.get<IGoalTimeFrameResponse>(`${this.TIME_FRAME_URL}/all`)
			.pipe(catchError((error) => this.errorHandler(error)))
			.toPromise();
	}

	delete(id: string): Promise<any> {
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

	errorHandler(error: HttpErrorResponse) {
		this.toastrService.danger(error.message, 'Error');
		return throwError(error.message);
	}

	update(id: string, goalTimeFrame: GoalTimeFrame): Promise<GoalTimeFrame> {
		return this._http
			.put<GoalTimeFrame>(`${this.TIME_FRAME_URL}/${id}`, goalTimeFrame)
			.pipe(first())
			.toPromise();
	}
}
