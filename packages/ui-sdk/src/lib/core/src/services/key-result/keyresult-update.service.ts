import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { IKeyResultUpdate } from '@gauzy/contracts';
import { firstValueFrom, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { API_PREFIX } from '@gauzy/ui-sdk/common';
import { ToastrService } from '../notification';

@Injectable({
	providedIn: 'root'
})
export class KeyResultUpdateService {
	private readonly API_URL = `${API_PREFIX}/key-result-updates`;

	constructor(private _http: HttpClient, private toastrService: ToastrService) {}

	createUpdate(keyResultUpdate): Promise<IKeyResultUpdate> {
		return firstValueFrom(
			this._http
				.post<IKeyResultUpdate>(`${this.API_URL}`, keyResultUpdate)
				.pipe(catchError((error) => this.errorHandler(error)))
		);
	}

	deleteBulkByKeyResultId(id: string): Promise<any> {
		const data = JSON.stringify({ id });
		return firstValueFrom(
			this._http.delete(`${this.API_URL}/deleteBulkByKeyResultId`, {
				params: { data }
			})
		);
	}

	errorHandler(error: HttpErrorResponse) {
		this.toastrService.danger(error);
		return throwError(error.message);
	}
}
