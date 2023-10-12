import { Injectable } from '@angular/core';
import { IBaseRelationsEntityModel, IIntegration, IIntegrationTenant, IIntegrationTenantFindInput } from '@gauzy/contracts';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { toParams } from '@gauzy/common-angular';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class IntegrationsService {

	constructor(
		private readonly _http: HttpClient
	) { }

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
					const index = prev.findIndex(
						(p) => p.order === current.order
					);
					if (index > -1) {
						prev[index].integrationTypes = prev[
							index
						].integrationTypes.concat({
							name: current.name,
							id: current.id
						});
						return prev;
					}
					return prev.concat({
						groupName: current.groupName,
						order: current.order,
						integrationTypes: [
							{ name: current.name, id: current.id }
						]
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
	 *
	 * @param integrationId
	 * @param relations
	 * @returns
	 */
	fetchIntegrationTenant(
		integrationId: IIntegrationTenant['id'],
		relations: IBaseRelationsEntityModel
	) {
		return this._http.get<any>(`${API_PREFIX}/integration-tenant/${integrationId}`, {
			params: toParams({ ...relations })
		});
	}
}
