import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { IChangelog, IChangelogFindInput, IPagination } from '@gauzy/contracts';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable, tap } from 'rxjs';
import { API_PREFIX, buildHttpParams } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class ChangelogService {
	private http = inject(HttpClient);
	private _changelogs$: BehaviorSubject<IChangelog[]> = new BehaviorSubject([]);
	public changelogs$: Observable<IChangelog[]> = this._changelogs$.asObservable();

	getAll(request: IChangelogFindInput): Observable<IPagination<IChangelog>> {
		return this.http
			.get<IPagination<IChangelog>>(`${API_PREFIX}/changelog`, {
				params: buildHttpParams(request)
			})
			.pipe(tap(({ items }) => this._changelogs$.next(items)));
	}
}
