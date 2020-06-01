import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
	IAccessTokenSecretPair,
	IAccessTokenDto,
	IAccessToken,
	IEngagement,
	IUpworkApiConfig,
	IIntegrationMap,
} from '@gauzy/models';

@Injectable({
	providedIn: 'root',
})
export class UpworkService {
	constructor(private http: HttpClient) {}

	uploadTransaction(formData: FormData): Observable<any> {
		return this.http.post(
			'/api/integrations/upwork/transactions',
			formData
		);
	}

	getAccessTokenSecretPair(config): Observable<IAccessTokenSecretPair> {
		return this.http.post<IAccessTokenSecretPair>(
			'/api/integrations/upwork/token-secret-pair',
			config
		);
	}

	getAccessToken(accessTokenDto: IAccessTokenDto): Observable<IAccessToken> {
		return this.http.post<IAccessToken>(
			'/api/integrations/upwork/access-token',
			accessTokenDto
		);
	}

	getContracts(config): Observable<IEngagement[]> {
		const data = JSON.stringify({ config });
		return this.http.get<IEngagement[]>(
			'/api/integrations/upwork/freelancer-contracts',
			{ params: { data } }
		);
	}

	getConfig(integrationId): Observable<IUpworkApiConfig> {
		return this.http.get<IUpworkApiConfig>(
			`/api/integrations/upwork/config/${integrationId}`
		);
	}

	syncContracts(syncContractsDto): Observable<IIntegrationMap[]> {
		return this.http.post<IIntegrationMap[]>(
			`/api/integrations/upwork/sync-contracts`,
			syncContractsDto
		);
	}

	syncContractsRelatedData(dto) {
		return this.http.post<IIntegrationMap[]>(
			`/api/integrations/upwork/sync-contracts-related-data`,
			dto
		);
	}
}
