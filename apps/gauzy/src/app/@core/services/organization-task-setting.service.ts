import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IOrganizationTaskSettingCreateInput, IOrganizationTaskSetting, IOrganizationTaskSettingUpdateInput } from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
    providedIn: 'root',
})
export class OrganizationTaskSettingService {
    private readonly API_URL = `${API_PREFIX}/organization-task-setting`;

    constructor(private readonly http: HttpClient) { }

    create(
        body: IOrganizationTaskSettingCreateInput
    ): Observable<IOrganizationTaskSetting> {
        return this.http.post<IOrganizationTaskSetting>(this.API_URL, body);
    }

    edit(
        body: Partial<IOrganizationTaskSettingUpdateInput>
    ): Observable<IOrganizationTaskSetting> {
        return this.http.put<IOrganizationTaskSetting>(
            `${this.API_URL}/${body.id}`,
            body
        );
    }
    getByOrganizationId(
        id: IOrganizationTaskSetting['id']
    ): Observable<IOrganizationTaskSetting> {
        return this.http.get<IOrganizationTaskSetting>(
            `${this.API_URL}/organization/${id}`
        );
    }
}
