import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { KeyResultUpdates } from '@gauzy/models';
import { throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { NbToastrService } from '@nebular/theme';

@Injectable({
	providedIn: 'root'
})
export class KeyresultUpdateService {
	private readonly API_URL = '/api/key-result-updates';
	constructor(
		private _http: HttpClient,
		private toastrService: NbToastrService
	) {}

	createUpdate(keyresultUpdate): Promise<KeyResultUpdates> {
		console.log(keyresultUpdate);
		return this._http
			.post<KeyResultUpdates>(`${this.API_URL}/create`, keyresultUpdate)
			.pipe(
				tap(() =>
					this.toastrService.primary('Update Added', 'Success')
				),
				catchError((error) => this.errorHandler(error))
			)
			.toPromise();
	}

	errorHandler(error: HttpErrorResponse) {
		this.toastrService.danger(error.message, 'Error');
		return throwError(error.message);
	}
}
