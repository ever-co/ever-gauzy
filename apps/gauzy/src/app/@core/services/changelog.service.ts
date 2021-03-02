import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IChangelog, IPagination } from '@gauzy/contracts';
import { UntilDestroy } from '@ngneat/until-destroy';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { tap } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@UntilDestroy()
@Injectable({
	providedIn: 'root'
})
export class ChangelogService {
	private _changelogs$: BehaviorSubject<IChangelog[]> = new BehaviorSubject(
		[]
	);
	public changelogs$: Observable<
		IChangelog[]
	> = this._changelogs$.asObservable();

	constructor(protected readonly http: HttpClient) {}

	getAll(): Observable<IPagination<IChangelog>> {
		return this.http
			.get<IPagination<IChangelog>>(`${API_PREFIX}/changelog`)
			.pipe(tap(({ items }) => this._changelogs$.next(items)));
	}
}
