import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import {
	IBasePerTenantAndOrganizationEntityModel,
	IGithubAppInstallInput,
	IGithubIssue,
	IGithubIssueFindInput,
	IGithubRepository,
	IGithubRepositoryResponse,
	IIntegrationMapSyncRepository,
	IIntegrationTenant,
	IOrganization,
	IOrganizationGithubRepository,
	IOrganizationGithubRepositoryUpdateInput,
	IOrganizationProject
} from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-core/common';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class GithubService {
	constructor(private readonly _http: HttpClient) {}

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
		query: IGithubIssueFindInput
	): Observable<IGithubIssue[]> {
		const url = `${API_PREFIX}/integration/github/${integrationId}/${owner}/${repo}/issues`;
		const params = toParams(query);

		return this._http.get<IGithubIssue[]>(url, { params });
	}

	/**
	 * Synchronize a GitHub repository.
	 * @param input The synchronization input data.
	 * @returns An Observable of the synchronized IntegrationMap.
	 */
	syncGithubRepository(input: IIntegrationMapSyncRepository): Observable<IOrganizationGithubRepository> {
		const url = `${API_PREFIX}/integration/github/repository/sync`;
		return this._http.post<IOrganizationGithubRepository>(url, input);
	}

	/**
	 * Update a GitHub repository's information.
	 *
	 * @param id - A string representing the unique identifier of the GitHub repository to be updated.
	 * @param input - An object containing the data to update the GitHub repository.
	 * @returns An Observable that emits the updated GitHub repository data.
	 */
	updateGithubRepository(
		id: string,
		input: IOrganizationGithubRepositoryUpdateInput
	): Observable<IOrganizationGithubRepository> {
		// Construct the URL for the API endpoint.
		const url = `${API_PREFIX}/integration/github/repository/${id}`;

		// Send an HTTP PUT request to update the GitHub repository using the provided input.
		return this._http.put<IOrganizationGithubRepository>(url, input);
	}

	/**
	 * Auto-synchronize GitHub issues for a specific repository.
	 *
	 * @param integrationId - The ID of the integration tenant.
	 * @param repository - The GitHub repository to auto-sync issues for.
	 * @param options - Additional options for synchronization, including organization, tenant, and an optional project.
	 * @returns An Observable representing the result of the auto-synchronization.
	 */
	public autoSyncIssues(
		integrationId: IIntegrationTenant['id'],
		repository: IOrganizationGithubRepository,
		options: {
			organizationId: IOrganization['id'];
			tenantId: IOrganization['tenantId'];
			projectId?: IOrganizationProject['id'];
		}
	): Observable<any> {
		return this._http.post(`${API_PREFIX}/integration/github/${integrationId}/auto-sync/issues`, {
			integrationId,
			repository,
			projectId: options.projectId,
			organizationId: options.organizationId,
			tenantId: options.tenantId
		});
	}

	/**
	 * Sync GitHub issues and labels for a given organization and integration.
	 *
	 * @param integrationId - The ID of the integration.
	 * @param options - An object containing organizationId, tenantId, and issues.
	 * @returns An observable that represents the HTTP POST request to sync issues and labels.
	 */
	public manualSyncIssues(
		integrationId: IIntegrationTenant['id'],
		repository: IOrganizationGithubRepository,
		options: {
			organizationId: IOrganization['id'];
			tenantId: IOrganization['tenantId'];
			issues: IGithubIssue[];
			projectId?: IOrganizationProject['id'];
		}
	): Observable<any> {
		return this._http.post(`${API_PREFIX}/integration/github/${integrationId}/manual-sync/issues`, {
			integrationId,
			repository,
			issues: this._mapIssuePayload(options.issues),
			projectId: options.projectId,
			organizationId: options.organizationId,
			tenantId: options.tenantId
		});
	}

	/**
	 * Maps a GitHub repository's data to a custom payload object.
	 *
	 * @param data - The GitHub repository data to map.
	 * @returns A custom payload object with selected properties.
	 */
	private _mapRepositoryPayload(data: IGithubRepository): any {
		const { id, name, full_name, owner, visibility, open_issues_count } = data;
		return {
			id,
			name,
			full_name,
			owner: {
				login: owner.login
			},
			visibility,
			open_issues_count,
			private: data.private
		};
	}

	/**
	 * Map GitHub issue payload data to the required format.
	 *
	 * @param data - An array of GitHub issues.
	 * @returns An array of mapped issue payload data.
	 */
	private _mapIssuePayload(data: IGithubIssue[]): any[] {
		return data.map(({ id, number, title, state, body, labels = [] }) => ({
			id,
			number,
			title,
			state,
			body,
			labels
		}));
	}
}
