import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IOrganizationTaskSetting, IOrganizationTaskSettingFindInput } from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-sdk/common';
import { API_PREFIX } from '@gauzy/ui-sdk/common';
import { CrudService } from './crud/crud.service';

@Injectable({
	providedIn: 'root'
})
export class OrganizationTaskSettingService extends CrudService<IOrganizationTaskSetting> {
	private static readonly API_URL = `${API_PREFIX}/organization-task-setting`;

	constructor(protected readonly http: HttpClient) {
		super(http, OrganizationTaskSettingService.API_URL);
	}

	/**
	 *
	 * @param id
	 * @returns
	 */
	getByOrganization(params: IOrganizationTaskSettingFindInput): Observable<IOrganizationTaskSetting> {
		return this.http.get<IOrganizationTaskSetting>(`${this.API_URL}/organization`, {
			params: toParams({
				...params
			})
		});
	}
}
