import { Injectable } from '@angular/core';
import { Goals } from '@gauzy/models';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { tap, catchError, first } from 'rxjs/operators';
import { NbToastrService } from '@nebular/theme';

interface IGoalResponse {
	items: Goals[];
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

	createGoal(goal): Observable<Goals> {
		return this._http.post<Goals>(`${this.API_URL}/create`, goal).pipe(
			tap(() => this.toastrService.primary('Goal Created', 'Success')),
			catchError((error) => this.errorHandler(error))
		);
	}

	update(id: string, goals: Goals): Promise<Goals> {
		return this._http
			.put<Goals>(`${this.API_URL}/${id}`, goals)
			.pipe(first())
			.toPromise();
	}

	getAllGoals(): Observable<IGoalResponse> {
		return this._http
			.get<IGoalResponse>(`${this.API_URL}/all`)
			.pipe(catchError((error) => this.errorHandler(error)));
	}

	errorHandler(error: HttpErrorResponse) {
		this.toastrService.danger(error.message, 'Error');
		return throwError(error.message);
	}
}
