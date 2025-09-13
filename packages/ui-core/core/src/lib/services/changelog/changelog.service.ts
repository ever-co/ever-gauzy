import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IChangelog, IChangelogFindInput, IPagination } from '@gauzy/contracts';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { environment } from '@gauzy/ui-config';

@Injectable({
	providedIn: 'root'
})
export class ChangelogService {
	private _changelogs$: BehaviorSubject<IChangelog[]> = new BehaviorSubject([]);
	public changelogs$: Observable<IChangelog[]> = this._changelogs$.asObservable();

	constructor(private readonly http: HttpClient) {}

	isPluginEnabled(): boolean {
		return environment?.plugins?.useChangelog ?? false;
	}

	getAll(request: IChangelogFindInput): Observable<IPagination<IChangelog>> {
		const params = toParams(request);
		if (!this.isPluginEnabled()) {
			const emptyPagination: IPagination<IChangelog> = { items: [], total: 0 };
			return of(emptyPagination);
		}
		return this.http
			.get<IPagination<IChangelog>>(`${API_PREFIX}/changelog`, {
				params
			})
			.pipe(tap(({ items }) => this._changelogs$.next(items)));
	}
}
