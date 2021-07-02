import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IImportHistory, IPagination } from '@gauzy/contracts';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { API_PREFIX } from '../constants';
import { tap } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class ImportService {

	private _history$: BehaviorSubject<IImportHistory[]> = new BehaviorSubject([]);
	public history$: Observable<IImportHistory[]> = this._history$.asObservable();

	constructor(private readonly _http: HttpClient) {}

	getHistory() {
		return this._http.get<IPagination<IImportHistory>>(
			`${API_PREFIX}/import`
		).pipe(
			tap(({ items }) => this._history$.next(items)),
		);
	}
}
