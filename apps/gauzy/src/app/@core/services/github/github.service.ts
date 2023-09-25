import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IBasePerTenantAndOrganizationEntityModel, IGithubAppInstallInput, IGithubRepositoryResponse, IIntegrationTenant } from '@gauzy/contracts';
import { Observable, firstValueFrom } from 'rxjs';
import { toParams } from '@gauzy/common-angular';
import { API_PREFIX } from '../../constants';

@Injectable({
    providedIn: 'root',
})
export class GithubService {

    constructor(
        private readonly _http: HttpClient
    ) { }

    /**
     *
     * @param input
     * @returns
     */
    async addInstallationApp(input: IGithubAppInstallInput): Promise<IIntegrationTenant> {
        return firstValueFrom(
            this._http.post<IIntegrationTenant>(`${API_PREFIX}/integration/github/install`, input)
        );
    }

    /**
     *
     */
    getRepositories(
        installation_id: string,
        query: IBasePerTenantAndOrganizationEntityModel
    ): Observable<IGithubRepositoryResponse> {
        return this._http.get<IGithubRepositoryResponse>(`${API_PREFIX}/integration/github/${installation_id}/repositories`, {
            params: toParams(query)
        });
    }
}
