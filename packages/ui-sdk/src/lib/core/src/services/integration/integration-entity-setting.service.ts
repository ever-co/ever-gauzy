import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IIntegrationEntitySetting, IIntegrationTenant, IPagination } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable({
	providedIn: 'root'
})
export class IntegrationEntitySettingService {
	constructor(private readonly _http: HttpClient) {}

	/**
	 * Retrieve entity settings for a given integration.
	 * @param integrationId - The ID of the integration.
	 * @returns An observable of entity settings.
	 */
	getEntitySettings(integrationId: IIntegrationTenant['id']): Observable<IPagination<IIntegrationEntitySetting>> {
		const url = `${API_PREFIX}/integration-entity-setting/integration/${integrationId}`;
		return this._http.get<IPagination<IIntegrationEntitySetting>>(url);
	}

	/**
	 * Update entity settings for a given integration.
	 * @param integrationId - The ID of the integration.
	 * @param settings - The entity settings to update.
	 * @returns An observable of updated entity settings.
	 */
	updateEntitySettings(
		integrationId: IIntegrationTenant['id'],
		settings: IIntegrationEntitySetting | IIntegrationEntitySetting[]
	): Observable<IIntegrationEntitySetting[]> {
		const url = `${API_PREFIX}/integration-entity-setting/integration/${integrationId}`;
		return this._http.put<IIntegrationEntitySetting[]>(url, settings);
	}
}
