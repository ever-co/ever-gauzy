import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IChangelog, IChangelogCreateInput, IChangelogFindInput, ID, IPagination } from '@gauzy/contracts';
import { BehaviorSubject, of } from 'rxjs';
import { Observable } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class ChangelogService {
	private readonly API_URL = `${API_PREFIX}/changelog`;
	private _changelogs$: BehaviorSubject<IChangelog[]> = new BehaviorSubject([]);
	public changelogs$: Observable<IChangelog[]> = this._changelogs$.asObservable();

	/**
	 * What {@link changelogs$} was last read with (the "What's New" sidebar's query): read again after every
	 * change, so the sidebar shows the change.
	 */
	private _publishedRequest: IChangelogFindInput | null = null;

	constructor(private readonly http: HttpClient) {}

	/**
	 * The entries matching `request`, published to {@link changelogs$} for the "What's New" sidebar.
	 */
	getAll(request: IChangelogFindInput): Observable<IPagination<IChangelog>> {
		this._publishedRequest = request;
		return this.find(request).pipe(tap(({ items }) => this._changelogs$.next(items)));
	}

	/**
	 * The entries matching `request`, newest first, without touching what the sidebar shows (the What's New
	 * management page lists the register page's feature cards too).
	 */
	find(request: IChangelogFindInput): Observable<IPagination<IChangelog>> {
		return this.http.get<IPagination<IChangelog>>(this.API_URL, { params: toParams(request) });
	}

	/**
	 * Adds an entry. Only the installation's operator may: anyone else is refused (403).
	 */
	create(input: IChangelogCreateInput): Observable<IChangelog> {
		return this.http.post<IChangelog>(this.API_URL, input).pipe(switchMap((entry) => this._refreshSidebar(entry)));
	}

	/**
	 * Changes an entry. Only the installation's operator may: anyone else is refused (403).
	 */
	update(id: ID, input: IChangelogCreateInput): Observable<IChangelog> {
		return this.http
			.put<IChangelog>(`${this.API_URL}/${id}`, input)
			.pipe(switchMap((entry) => this._refreshSidebar(entry)));
	}

	/**
	 * Takes an entry down. The entry is soft-deleted, so {@link recover} brings it back.
	 */
	delete(id: ID): Observable<IChangelog> {
		return this.http
			.delete<IChangelog>(`${this.API_URL}/${id}/soft`)
			.pipe(switchMap((entry) => this._refreshSidebar(entry)));
	}

	/**
	 * Brings back an entry taken down with {@link delete}.
	 */
	recover(id: ID): Observable<IChangelog> {
		return this.http
			.put<IChangelog>(`${this.API_URL}/${id}/recover`, {})
			.pipe(switchMap((entry) => this._refreshSidebar(entry)));
	}

	/**
	 * Reads the sidebar's entries again after a change, then hands back what the change returned. The
	 * change is saved either way: a failed read leaves the sidebar as it was rather than failing the change.
	 */
	private _refreshSidebar<T>(result: T): Observable<T> {
		if (!this._publishedRequest) {
			return of(result);
		}
		return this.getAll(this._publishedRequest).pipe(
			catchError(() => of(null)),
			map(() => result)
		);
	}
}
