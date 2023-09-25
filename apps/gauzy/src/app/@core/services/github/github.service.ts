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
     * Add a GitHub app installation.
     * @param input The input data for the GitHub app installation.
     * @returns A promise that resolves to the integration tenant object.
     */
    async addInstallationApp(input: IGithubAppInstallInput): Promise<IIntegrationTenant> {
        const url = `${API_PREFIX}/integration/github/install`;
        return firstValueFrom(this._http.post<IIntegrationTenant>(url, input));
    }

    /**
     * Fetches repositories for a given integration and organization.
     * @param integrationId The ID of the integration.
     * @param query Query parameters for the request.
     */
    getRepositories(
        integrationId: IIntegrationTenant['id'],
        query: IBasePerTenantAndOrganizationEntityModel
    ): Observable<IGithubRepositoryResponse> {
        const url = `${API_PREFIX}/integration/github/${integrationId}/repositories`;
        const params = toParams(query);

        return this._http.get<IGithubRepositoryResponse>(url, { params });
    }
}
