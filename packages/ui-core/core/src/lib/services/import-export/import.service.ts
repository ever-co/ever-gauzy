import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ID, IImportHistory, IPagination } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

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

	/**
	 * Downloads the archive one import was made from.
	 *
	 * Goes through the authenticated API rather than a storage URL: the archive is a full tenant data
	 * dump and is no longer reachable at a public link.
	 *
	 * @param id - The import-history row.
	 * @returns Observable of the archive's bytes.
	 */
	downloadArchive(id: ID): Observable<Blob> {
		return this.http.get(`${API_PREFIX}/import/history/${id}/download`, { responseType: 'blob' });
	}
}
