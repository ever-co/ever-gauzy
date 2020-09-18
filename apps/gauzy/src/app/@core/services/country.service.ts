import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ICountry } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class CountryService {
	constructor(private http: HttpClient) {}

	getAll(): Promise<{ items: ICountry[]; total: number }> {
		return this.http
			.get<{ items: ICountry[]; total: number }>(`/api/country`)
			.pipe(first())
			.toPromise();
	}
}
