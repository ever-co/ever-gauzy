import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
	IIntegration,
	IIntegrationSetting,
	IHubstaffOrganization,
	IHubstaffProject
} from '@gauzy/models';
import { v4 as uuid } from 'uuid';
import { Store } from './store.service';
import { switchMap, tap } from 'rxjs/operators';
import { environment } from 'apps/gauzy/src/environments/environment';

@Injectable({
	providedIn: 'root'
})
export class HubstaffService {
	private ACCESS_TOKEN: string;

	constructor(private _http: HttpClient, private _store: Store) {}

	getToken(integrationId: string): Observable<IIntegrationSetting> {
		return this._http
			.get<IIntegrationSetting>(
				`/api/integrations/hubstaff/get-token/${integrationId}`
			)
			.pipe(
				tap(({ settingsValue }) => (this.ACCESS_TOKEN = settingsValue))
			);
	}

	authorizeClient(client_id: string): void {
		//  'http://localhost:4200/pages/integrations/hubstaff';
		localStorage.setItem('client_id', client_id);
		const url = `https://account.hubstaff.com/authorizations/new?response_type=code&redirect_uri=${
			environment.HUBSTAFF_REDIRECT_URI
		}&realm=hubstaff&client_id=${client_id}&scope=hubstaff:read&state=oauth2&nonce=${uuid()}`;

		window.location.replace(url);
	}

	addIntegration(
		code: string,
		client_secret: string
	): Observable<IIntegration> {
		const client_id = localStorage.getItem('client_id');

		const getAccessTokensDto = {
			client_id,
			code,
			redirect_uri: environment.HUBSTAFF_REDIRECT_URI,
			client_secret
		};

		return this._store.selectedOrganization$.pipe(
			switchMap(({ tenantId }) =>
				this._http.post<IIntegration>(
					'/api/integrations/hubstaff/add-integration',
					{
						...getAccessTokensDto,
						tenantId
					}
				)
			)
		);
	}

	getOrganizations(integrationId): Observable<IHubstaffOrganization[]> {
		return this._http.post<IHubstaffOrganization[]>(
			`/api/integrations/hubstaff/organizations/${integrationId}`,
			{
				token: this.ACCESS_TOKEN
			}
		);
	}

	getProjects(organizationId): Observable<IHubstaffProject[]> {
		return this._http.post<IHubstaffProject[]>(
			`/api/integrations/hubstaff/projects/${organizationId}`,
			{ token: this.ACCESS_TOKEN }
		);
	}

	syncProjects(projects, integrationId) {
		return this._store.selectedOrganization$.pipe(
			switchMap(({ id }) => {
				return this._http.post(
					`/api/integrations/hubstaff/sync-projects/${integrationId}`,
					{
						projects: this._mapNameAndSourceId(projects),
						orgId: id
					}
				);
			})
		);
	}

	private _mapNameAndSourceId(data: any[]) {
		return data.map(({ name, id }) => ({ name, sourceId: id }));
	}
}
