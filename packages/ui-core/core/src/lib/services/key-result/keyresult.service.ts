import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { IKeyResult } from '@gauzy/contracts';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { ToastrService } from '../notification';

interface IKeyResultResponse {
	items: IKeyResult[];
	count: number;
}

@Injectable({
	providedIn: 'root'
})
export class KeyResultService {
	private readonly API_URL = `${API_PREFIX}/key-results`;

	constructor(private _http: HttpClient, private toastrService: ToastrService) {}

	createKeyResult(keyResult): Promise<IKeyResult> {
		return firstValueFrom(
			this._http
				.post<IKeyResult>(`${this.API_URL}`, keyResult)
				.pipe(catchError((error) => this.errorHandler(error)))
		);
	}

	createBulkKeyResult(keyResults): Promise<IKeyResult[]> {
		return firstValueFrom(
			this._http
				.post<IKeyResult[]>(`${this.API_URL}/bulk`, keyResults)
				.pipe(catchError((error) => this.errorHandler(error)))
		);
	}

	async update(id: string, keyResult: IKeyResult): Promise<IKeyResult> {
		return firstValueFrom(this._http.put<IKeyResult>(`${this.API_URL}/${id}`, keyResult));
	}

	findKeyResult(id: string): Promise<IKeyResultResponse> {
		return firstValueFrom(
			this._http
				.get<IKeyResultResponse>(`${this.API_URL}/${id}`)
				.pipe(catchError((error) => this.errorHandler(error)))
		);
	}

	getAllKeyResults(keyResult): Observable<IKeyResultResponse> {
		return this._http
			.get<IKeyResultResponse>(`${this.API_URL}/${keyResult}`)
			.pipe(catchError((error) => this.errorHandler(error)));
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this._http.delete(`${this.API_URL}/${id}`));
	}

	errorHandler(error: HttpErrorResponse) {
		this.toastrService.danger(error.message, 'Error');
		return throwError(error.message);
	}
}
