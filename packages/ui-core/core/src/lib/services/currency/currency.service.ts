import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, EMPTY, Observable, Subject } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ICurrency, IPagination } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

@UntilDestroy()
@Injectable({ providedIn: 'root' })
export class CurrencyService {
	private _currencies$: BehaviorSubject<ICurrency[]> = new BehaviorSubject([]);
	public currencies$: Observable<ICurrency[]> = this._currencies$.asObservable();

	public find$: Subject<boolean> = new Subject();

	constructor(private http: HttpClient) {
		this._loadCurrencies();
	}

	private _loadCurrencies() {
		this.find$
			.pipe(
				filter((val: boolean) => val === true),
				tap(() => this.getAll()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	getAll() {
		const currencies$ = this._currencies$.getValue();
		if (currencies$.length > 0) {
			return EMPTY;
		}
		return this.http
			.get<IPagination<ICurrency>>(`${API_PREFIX}/currency`)
			.pipe(
				map(({ items, total }) => {
					this._currencies$.next(items);
					return { items, total };
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
