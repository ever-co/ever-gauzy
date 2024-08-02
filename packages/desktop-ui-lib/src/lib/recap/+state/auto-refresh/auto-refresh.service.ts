import { Injectable, OnDestroy } from '@angular/core';
import { Observable, startWith, Subject, switchMap, tap, timer } from 'rxjs';
import { AUTO_REFRESH_DELAY } from '../../../constants';
import { AutoRefreshQuery } from './auto-refresh.query';
import { AutoRefreshStore } from './auto-refresh.store';

@Injectable({
	providedIn: 'root'
})
export class AutoRefreshService implements OnDestroy {
	private readonly _subject$ = new Subject<void>();
	private readonly _refresh$ = new Subject<void>();

	constructor(private readonly query: AutoRefreshQuery, private readonly store: AutoRefreshStore) {
		this._subject$.pipe(switchMap(() => this.run$())).subscribe();

		this.enabled$.subscribe((enabled) => {
			enabled ? this.startRefresh() : this.stopRefresh();
		});
	}

	public get enabled$(): Observable<boolean> {
		return this.query.enabled$;
	}

	public get enabled(): boolean {
		return this.query.enabled;
	}

	public set enabled(enabled: boolean) {
		this.store.update({ enabled });
	}

	private startRefresh(): void {
		this._subject$.next();
	}

	private stopRefresh(): void {
		this._subject$.complete();
	}

	private run$(): Observable<number> {
		return timer(AUTO_REFRESH_DELAY, AUTO_REFRESH_DELAY).pipe(tap(() => this.refresh()));
	}

	public refresh(): void {
		this._refresh$.next();
	}

	public get refresh$(): Observable<void> {
		return this._refresh$.pipe(startWith(null));
	}

	ngOnDestroy(): void {
		this._subject$.complete();
	}
}
