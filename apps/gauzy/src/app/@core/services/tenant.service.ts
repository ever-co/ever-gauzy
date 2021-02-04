import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { ITenant, ITenantCreateInput, ITenantSetting } from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class TenantService {
	constructor(private http: HttpClient) {}

	API_URL = `${API_PREFIX}/tenant`;

	create(createInput: ITenantCreateInput): Promise<ITenant> {
		return this.http
			.post<ITenant>(`${this.API_URL}`, createInput)
			.pipe(first())
			.toPromise();
	}

	getSettings() {
		return this.http
			.get<ITenantSetting>(`${API_PREFIX}/tenant-setting`)
			.toPromise();
	}

	saveSettings(request: ITenantSetting) {
		return this.http
			.post<ITenantSetting>(`${API_PREFIX}/tenant-setting`, request)
			.toPromise();
	}
}
