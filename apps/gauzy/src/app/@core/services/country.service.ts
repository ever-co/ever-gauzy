import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Country } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class CountryService {
	constructor(private http: HttpClient) {}

	getAll(): Promise<{ items: Country[]; total: number }> {
		return this.http
			.get<{ items: Country[]; total: number }>(`/api/country`)
			.pipe(first())
			.toPromise();
	}
}
