import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ICurrency, IPagination } from '@gauzy/models';
import { BehaviorSubject, EMPTY } from 'rxjs';
import { Observable } from 'rxjs/Observable';
import { map } from 'rxjs/operators';

@Injectable()
export class CurrencyService {
	private _currencies$: BehaviorSubject<ICurrency[]> = new BehaviorSubject(
		[]
	);
	public currencies$: Observable<
		ICurrency[]
	> = this._currencies$.asObservable();

	constructor(private http: HttpClient) {}

	getAll(): Observable<IPagination<ICurrency>> {
		const currencies$ = this._currencies$.getValue();
		if (currencies$.length) {
			return EMPTY;
		}

		return this.http.get<IPagination<ICurrency>>(`api/currency`).pipe(
			map(({ items, total }) => {
				this._currencies$.next(items);
				return { items, total };
			})
		);
	}
}
