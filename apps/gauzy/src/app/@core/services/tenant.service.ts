import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { ITenant, ITenantCreateInput } from '@gauzy/models';

@Injectable()
export class TenantService {
	constructor(private http: HttpClient) {}

	API_URL = '/api/tenant';

	create(createInput: ITenantCreateInput): Promise<ITenant> {
		return this.http
			.post<ITenant>(`${this.API_URL}`, createInput)
			.pipe(first())
			.toPromise();
	}
}
