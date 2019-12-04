import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Countries } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class CountriesService {
	constructor(private http: HttpClient) {}

	getAll(): Promise<{ items: Countries[]; total: number }> {
		return this.http
			.get<{ items: Countries[]; total: number }>(`/api/countries`)
			.pipe(first())
			.toPromise();
	}
}
