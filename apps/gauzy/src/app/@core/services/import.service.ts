import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IImportHistory, IPagination } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable({
	providedIn: 'root'
})
export class ImportService {
	private _history$: BehaviorSubject<IImportHistory[]> = new BehaviorSubject([]);
	public history$: Observable<IImportHistory[]> = this._history$.asObservable();

	constructor(private readonly http: HttpClient) {}

	/**
	 * Fetches import history from the server and updates the history observable.
	 * @returns Observable of IPagination<IImportHistory>
	 */
	getHistory(): Observable<IPagination<IImportHistory>> {
		return this.http
			.get<IPagination<IImportHistory>>(`${API_PREFIX}/import/history`)
			.pipe(tap(({ items }) => this._history$.next(items)));
	}
}
