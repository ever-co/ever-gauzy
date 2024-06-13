import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ITenant, ITenantCreateInput, ITenantSetting } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable()
export class TenantService {
	constructor(private http: HttpClient) {}

	API_URL = `${API_PREFIX}/tenant`;

	create(createInput: ITenantCreateInput): Promise<ITenant> {
		return firstValueFrom(this.http.post<ITenant>(`${this.API_URL}`, createInput));
	}

	getSettings() {
		return firstValueFrom(this.http.get<ITenantSetting>(`${API_PREFIX}/tenant-setting`));
	}

	saveSettings(request: ITenantSetting) {
		return firstValueFrom(this.http.post<ITenantSetting>(`${API_PREFIX}/tenant-setting`, request));
	}
}
