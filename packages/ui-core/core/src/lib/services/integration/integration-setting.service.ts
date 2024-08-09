import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IIntegrationSetting } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { CrudService } from '../crud/crud.service';

@Injectable({
	providedIn: 'root'
})
export class IntegrationSettingService extends CrudService<IIntegrationSetting> {
	static readonly API_URL = `${API_PREFIX}/integration-setting`;

	constructor(readonly _http: HttpClient) {
		super(_http, IntegrationSettingService.API_URL);
	}
}
