import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs/internal/Observable';
import { IIntegrationTenantFindInput, IIntegrationTenant, IPagination } from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-core/common';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { CrudService } from '../crud/crud.service';

@Injectable({
	providedIn: 'root'
})
export class IntegrationTenantService extends CrudService<IIntegrationTenant> {
	static readonly API_URL = `${API_PREFIX}/integration-tenant`;

	constructor(private readonly _http: HttpClient) {
		super(_http, IntegrationTenantService.API_URL);
	}

	/**
	 * Get a list of IntegrationTenant entities based on specified criteria and optional relations.
	 *
	 * @param where - The criteria to filter IntegrationTenant entities.
	 * @param relations - Optional relations to include in the response.
	 * @returns An Observable of IPagination<IIntegrationTenant>.
	 */
	getAll(where: IIntegrationTenantFindInput, relations: string[] = []): Observable<IPagination<IIntegrationTenant>> {
		const url = `${API_PREFIX}/integration-tenant`;
		const params = toParams({ where, relations }); // Include relations in the parameters

		return this._http.get<IPagination<IIntegrationTenant>>(url, { params });
	}
}
