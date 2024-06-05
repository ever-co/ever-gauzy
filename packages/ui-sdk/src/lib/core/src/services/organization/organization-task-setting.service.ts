import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IOrganizationTaskSetting, IOrganizationTaskSettingFindInput } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-sdk/common';
import { CrudService } from '../crud/crud.service';

@Injectable({
	providedIn: 'root'
})
export class OrganizationTaskSettingService extends CrudService<IOrganizationTaskSetting> {
	private static readonly API_URL = `${API_PREFIX}/organization-task-setting`;

	constructor(protected readonly http: HttpClient) {
		super(http, OrganizationTaskSettingService.API_URL);
	}

	/**
	 * Retrieves organization task settings based on provided parameters.
	 * @param params The parameters used to find the organization task setting.
	 * @returns An Observable that emits the organization task setting.
	 */
	getByOrganization(params: IOrganizationTaskSettingFindInput): Observable<IOrganizationTaskSetting> {
		return this.http.get<IOrganizationTaskSetting>(`${this.API_URL}/organization`, {
			params: toParams(params)
		});
	}
}
