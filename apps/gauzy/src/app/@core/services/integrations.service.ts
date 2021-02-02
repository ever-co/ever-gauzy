import { Injectable } from '@angular/core';
import { IIntegration } from '@gauzy/contracts';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class IntegrationsService {
	constructor(private _http: HttpClient) {}

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
}
