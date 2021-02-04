import { Injectable } from '@angular/core';
import { IGoal, IGoalFindInput, IGoalResponse } from '@gauzy/contracts';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { throwError } from 'rxjs';
import { catchError, first } from 'rxjs/operators';
import { ToastrService } from './toastr.service';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class GoalService {
	private readonly API_URL = `${API_PREFIX}/goals`;

	constructor(
		private _http: HttpClient,
		private toastrService: ToastrService
	) {}

	createGoal(goal): Promise<IGoal> {
		return this._http
			.post<IGoal>(`${this.API_URL}/create`, goal)
			.pipe(catchError((error) => this.errorHandler(error)))
			.toPromise();
	}

	update(id: string, goal: IGoal): Promise<IGoal> {
		return this._http
			.put<IGoal>(`${this.API_URL}/${id}`, goal)
			.pipe(first())
			.toPromise();
	}

	getAllGoals(
		relations?: string[],
		findInput?: IGoalFindInput
	): Promise<IGoalResponse> {
		const data = JSON.stringify({ relations, findInput });
		return this._http
			.get<IGoalResponse>(`${this.API_URL}/all`, { params: { data } })
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
