import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { IKeyResultUpdate } from '@gauzy/models';
import { throwError } from 'rxjs';
import { tap, catchError, first } from 'rxjs/operators';
import { NbToastrService } from '@nebular/theme';

@Injectable({
	providedIn: 'root'
})
export class KeyResultUpdateService {
	private readonly API_URL = '/api/key-result-updates';
	constructor(
		private _http: HttpClient,
		private toastrService: NbToastrService
	) {}

	createUpdate(keyResultUpdate): Promise<IKeyResultUpdate> {
		return this._http
			.post<IKeyResultUpdate>(`${this.API_URL}/create`, keyResultUpdate)
			.pipe(
				tap(() =>
					this.toastrService.primary('Update Added', 'Success')
				),
				catchError((error) => this.errorHandler(error))
			)
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
		this.toastrService.danger(error.message, 'Error');
		return throwError(error.message);
	}
}
