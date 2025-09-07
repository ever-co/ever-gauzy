import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, EMPTY, Observable, Subject } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ICountry, IPagination } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

@UntilDestroy()
@Injectable({ providedIn: 'root' })
export class CountryService {
	private _countries$: BehaviorSubject<ICountry[]> = new BehaviorSubject([]);
	public countries$: Observable<ICountry[]> = this._countries$.asObservable();

	public find$: Subject<boolean> = new Subject();

	constructor(private http: HttpClient) {
		this._loadCountries();
	}

	private _loadCountries() {
		this.find$
			.pipe(
				filter((val: boolean) => val === true),
				tap(() => this.getAll()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	getAll() {
		const currencies$ = this._countries$.getValue();
		if (currencies$.length > 0) {
			return EMPTY;
		}
		return this.http
			.get<IPagination<ICountry>>(`${API_PREFIX}/country`)
			.pipe(
				map(({ items, total }) => {
					this._countries$.next(items);
					return { items, total };
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Get a country by ISO code
	 * @param isoCode string
	 */
	getByIsoCode(isoCode: string): Observable<ICountry | null> {
		if (!isoCode) {
			return new BehaviorSubject<ICountry | null>(null).asObservable();
		}

		return this.http.get<ICountry>(`${API_PREFIX}/country/${isoCode}`).pipe(
			tap((country) => {
				if (!country) {
					console.error('Failed to fetch country by ISO code');
				}
			}),
			untilDestroyed(this)
		);
	}
}
