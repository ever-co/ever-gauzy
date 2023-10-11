import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
    IBasePerTenantAndOrganizationEntityModel,
    IGithubAppInstallInput,
    IGithubIssue,
    IGithubRepository,
    IGithubRepositoryResponse,
    IIntegrationTenant,
    IOrganization
} from '@gauzy/contracts';
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
     * Get GitHub repositories for a specific integration.
     *
     * @param {string} integrationId - The ID of the integration.
     * @param {IBasePerTenantAndOrganizationEntityModel} query - Query parameters for the request.
     * @returns {Observable<IGithubRepositoryResponse>} An observable that emits GitHub repositories.
     */
    getRepositories(
        integrationId: IIntegrationTenant['id'],
        query: IBasePerTenantAndOrganizationEntityModel
    ): Observable<IGithubRepositoryResponse> {
        const url = `${API_PREFIX}/integration/github/${integrationId}/repositories`;
        const params = toParams(query);

        return this._http.get<IGithubRepositoryResponse>(url, { params });
    }

    /**
     * Get GitHub repository issues for a specific integration, owner, and repository.
     *
     * @param {string} integrationId - The ID of the integration.
     * @param {string} owner - The owner (username or organization) of the repository.
     * @param {string} repo - The name of the repository.
     * @param {IBasePerTenantAndOrganizationEntityModel} query - Query parameters for the request.
     * @returns {Observable<IGithubIssue[]>} An observable that emits GitHub issues.
     */
    getRepositoryIssues(
        integrationId: IIntegrationTenant['id'],
        owner: string,
        repo: string,
        query: IBasePerTenantAndOrganizationEntityModel
    ): Observable<IGithubIssue[]> {
        const url = `${API_PREFIX}/integration/github/${integrationId}/${owner}/${repo}/issues`;
        const params = toParams(query);

        return this._http.get<IGithubIssue[]>(url, { params });
    }

    /**
     * Sync GitHub issues and labels for a given organization and integration.
     *
     * @param integrationId - The ID of the integration.
     * @param options - An object containing organizationId, tenantId, and issues.
     * @returns An observable that represents the HTTP POST request to sync issues and labels.
     */
    public syncIssuesAndLabels(
        integrationId: IIntegrationTenant['id'],
        options: {
            organizationId: IOrganization['id'];
            tenantId: IOrganization['tenantId'];
            issues: IGithubIssue[];
            visibility: IGithubRepository['visibility'];
        }
    ): Observable<any> {
        return this._http.post(`${API_PREFIX}/integration/github/${integrationId}/sync-issues`, {
            issues: this._mapIssuePayload(options.issues),
            organizationId: options.organizationId,
            tenantId: options.tenantId,
            visibility: options.visibility
        });
    }

    /**
     * Map GitHub issue payload data to the required format.
     *
     * @param data - An array of GitHub issues.
     * @returns An array of mapped issue payload data.
     */
    private _mapIssuePayload(data: IGithubIssue[]): any[] {
        return data.map(({ id, number, title, state, body }) => ({
            sourceId: id,
            number,
            title,
            state,
            body
        }));
    }
}
