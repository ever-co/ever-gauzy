import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { ITenant, ITenantCreateInput, ITenantSetting } from '@gauzy/models';

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

	getSettings() {
		return this.http.get<ITenantSetting>('/api/tenant-setting').toPromise();
	}

	saveSettings(request: ITenantSetting) {
		return this.http
			.post<ITenantSetting>('/api/tenant-setting', request)
			.toPromise();
	}
}
