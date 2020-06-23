import { Injectable } from '@angular/core';
import { Goal } from '@gauzy/models';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { throwError } from 'rxjs';
import { tap, catchError, first } from 'rxjs/operators';
import { NbToastrService } from '@nebular/theme';

interface IGoalResponse {
	items: Goal[];
	count: number;
}

@Injectable({
	providedIn: 'root'
})
export class GoalService {
	private readonly API_URL = '/api/goals';
	constructor(
		private _http: HttpClient,
		private toastrService: NbToastrService
	) {}

	createGoal(goal): Promise<Goal> {
		return this._http
			.post<Goal>(`${this.API_URL}/create`, goal)
			.pipe(
				tap(() =>
					this.toastrService.primary('Goal Created', 'Success')
				),
				catchError((error) => this.errorHandler(error))
			)
			.toPromise();
	}

	update(id: string, goal: Goal): Promise<Goal> {
		return this._http
			.put<Goal>(`${this.API_URL}/${id}`, goal)
			.pipe(first())
			.toPromise();
	}

	getAllGoals(): Promise<IGoalResponse> {
		return this._http
			.get<IGoalResponse>(`${this.API_URL}/all`)
			.pipe(catchError((error) => this.errorHandler(error)))
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this._http
			.delete(`${this.API_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	errorHandler(error: HttpErrorResponse) {
		this.toastrService.danger(error.message, 'Error');
		return throwError(error.message);
	}
}
