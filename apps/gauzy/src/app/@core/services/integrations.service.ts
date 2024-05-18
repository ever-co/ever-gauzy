import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import {
	IBaseRelationsEntityModel,
	IIntegration,
	IIntegrationTenant,
	IIntegrationTenantFindInput
} from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-sdk/common';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable({
	providedIn: 'root'
})
export class IntegrationsService {
	constructor(private readonly _http: HttpClient) {}

	fetchIntegrations(
		integrationTypeId: string,
		searchQuery: string = '',
		filter: string | boolean = 'all'
	): Observable<IIntegration[]> {
		const filters = JSON.stringify({
			integrationTypeId,
			searchQuery,
			filter
		});
		return this._http.get<IIntegration[]>(`${API_PREFIX}/integration`, {
			params: { filters }
		});
	}

	fetchIntegrationGroups() {
		return this._http.get<any[]>(`${API_PREFIX}/integration/types`).pipe(
			map((groups) =>
				groups.reduce((prev, current) => {
					const index = prev.findIndex((p) => p.order === current.order);
					if (index > -1) {
						prev[index].integrationTypes = prev[index].integrationTypes.concat({
							name: current.name,
							id: current.id
						});
						return prev;
					}
					return prev.concat({
						groupName: current.groupName,
						order: current.order,
						integrationTypes: [{ name: current.name, id: current.id }]
					});
				}, [])
			)
		);
	}

	/**
	 * Retrieve an integration tenant by specified options.
	 *
	 * @param input - The input options for finding the integration tenant.
	 * @returns The integration tenant if found, or `false` if not found or an error occurs.
	 */
	getIntegrationByOptions(input: IIntegrationTenantFindInput) {
		return this._http.get<any>(`${API_PREFIX}/integration-tenant/integration`, {
			params: toParams({ ...input })
		});
	}

	/**
	 * Get an IntegrationTenant by ID with optional relations.
	 *
	 * @param id - The ID of the IntegrationTenant.
	 * @param relations - Optional relations for the request.
	 * @returns {Observable<any>} An Observable of the HTTP response.
	 */
	getIntegrationTenant(
		id: IIntegrationTenant['id'],
		relations: IBaseRelationsEntityModel
	): Observable<IIntegrationTenant> {
		return this._http.get<any>(`${API_PREFIX}/integration-tenant/${id}`, {
			params: toParams({ ...relations })
		});
	}
}
