import { Injectable } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IHubstaffAccessTokens } from '@gauzy/models';

@Injectable({
	providedIn: 'root'
})
export class HubstaffService {
	private readonly API_URL = '';

	constructor(private _http: HttpClient) {}

	getAccessTokens(getAccessTokensDto): Observable<IHubstaffAccessTokens> {
		return this._http.post<IHubstaffAccessTokens>(
			'/api/integrations/hubstaff/access-tokens',
			getAccessTokensDto
		);
	}

	getOrganizations(token): Observable<any> {
		return this._http.post(`/api/integrations/hubstaff/organizations`, {
			token
		});
	}
}
