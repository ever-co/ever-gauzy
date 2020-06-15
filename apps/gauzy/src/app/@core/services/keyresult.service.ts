import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { KeyResult } from '@gauzy/models';
import { Observable, throwError } from 'rxjs';
import { tap, catchError, first } from 'rxjs/operators';
import { NbToastrService } from '@nebular/theme';

interface IKeyResultResponse {
	items: KeyResult[];
	count: number;
}

@Injectable({
	providedIn: 'root'
})
export class KeyresultService {
	private readonly API_URL = '/api/key-results';
	constructor(
		private _http: HttpClient,
		private toastrService: NbToastrService
	) {}

	createKeyResult(keyresult): Observable<KeyResult> {
		return this._http
			.post<KeyResult>(`${this.API_URL}/create`, keyresult)
			.pipe(
				tap(() =>
					this.toastrService.primary('Key Result Created', 'Success')
				),
				catchError((error) => this.errorHandler(error))
			);
	}

	update(id: string, keyresult: KeyResult): Promise<KeyResult> {
		return this._http
			.put<KeyResult>(`${this.API_URL}/${id}`, keyresult)
			.pipe(first())
			.toPromise();
	}

	getAllKeyResults(keyResult): Observable<IKeyResultResponse> {
		return this._http
			.get<IKeyResultResponse>(`${this.API_URL}/${keyResult}`)
			.pipe(catchError((error) => this.errorHandler(error)));
	}

	errorHandler(error: HttpErrorResponse) {
		this.toastrService.danger(error.message, 'Error');
		return throwError(error.message);
	}
}
