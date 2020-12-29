import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { IKeyResultUpdate } from '@gauzy/models';
import { throwError } from 'rxjs';
import { catchError, first } from 'rxjs/operators';
import { ToastrService } from './toastr.service';

@Injectable({
	providedIn: 'root'
})
export class KeyResultUpdateService {
	private readonly API_URL = '/api/key-result-updates';
	constructor(
		private _http: HttpClient,
		private toastrService: ToastrService
	) {}

	createUpdate(keyResultUpdate): Promise<IKeyResultUpdate> {
		return this._http
			.post<IKeyResultUpdate>(`${this.API_URL}/create`, keyResultUpdate)
			.pipe(catchError((error) => this.errorHandler(error)))
			.toPromise();
	}

	deleteBulkByKeyResultId(id: string): Promise<any> {
		const data = JSON.stringify({ id });
		return this._http
			.delete(`${this.API_URL}/deleteBulkByKeyResultId`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	errorHandler(error: HttpErrorResponse) {
		this.toastrService.danger(error);
		return throwError(error.message);
	}
}
