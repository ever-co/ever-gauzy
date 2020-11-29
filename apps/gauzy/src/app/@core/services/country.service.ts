import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ICountry, IPagination } from '@gauzy/models';
import { BehaviorSubject, EMPTY, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class CountryService {
	private _countries$: BehaviorSubject<ICountry[]> = new BehaviorSubject([]);
	public countries$: Observable<ICountry[]> = this._countries$.asObservable();

	constructor(private http: HttpClient) {}

	getAll(): Observable<IPagination<ICountry>> {
		const currencies$ = this._countries$.getValue();
		if (currencies$.length) {
			return EMPTY;
		}

		return this.http.get<IPagination<ICountry>>(`api/country`).pipe(
			map(({ items, total }) => {
				this._countries$.next(items);
				return { items, total };
			})
		);
	}
}
