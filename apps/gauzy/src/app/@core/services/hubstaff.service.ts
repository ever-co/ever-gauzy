import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IIntegration } from '@gauzy/models';
import { v4 as uuid } from 'uuid';
import { Store } from './store.service';
import { switchMap } from 'rxjs/operators';
import { environment } from 'apps/gauzy/src/environments/environment';

@Injectable({
	providedIn: 'root'
})
export class HubstaffService {
	constructor(private _http: HttpClient, private _store: Store) {}

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

	getOrganizations(token): Observable<any> {
		return this._http.post(`/api/integrations/hubstaff/organizations`, {
			token
		});
	}
}
