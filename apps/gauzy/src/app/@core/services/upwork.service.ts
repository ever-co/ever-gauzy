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
	IntegrationEnum,
	IUpworkClientSecretPair
} from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class UpworkService {
	constructor(private http: HttpClient) {}

	uploadTransaction(formData: FormData): Observable<any> {
		return this.http.post(
			`${API_PREFIX}/integrations/upwork/transactions`,
			formData
		);
	}

	getAccessTokenSecretPair(
		config: IUpworkClientSecretPair,
		organizationId: string
	): Observable<IAccessTokenSecretPair> {
		return this.http.post<IAccessTokenSecretPair>(
			`${API_PREFIX}/integrations/upwork/token-secret-pair/${organizationId}`,
			config
		);
	}

	getAccessToken(
		accessTokenDto: IAccessTokenDto,
		organizationId: string
	): Observable<IAccessToken> {
		return this.http.post<IAccessToken>(
			`${API_PREFIX}/integrations/upwork/access-token/${organizationId}`,
			accessTokenDto
		);
	}

	getContracts(config): Observable<IEngagement[]> {
		const data = JSON.stringify({ config });
		return this.http.get<IEngagement[]>(
			`${API_PREFIX}/integrations/upwork/freelancer-contracts`,
			{ params: { data } }
		);
	}

	getConfig(dto): Observable<IUpworkApiConfig> {
		const { integrationId, data } = dto;
		return this.http.get<IUpworkApiConfig>(
			`${API_PREFIX}/integrations/upwork/config/${integrationId}`,
			{ params: { data } }
		);
	}

	syncContracts(syncContractsDto): Observable<IIntegrationMap[]> {
		return this.http.post<IIntegrationMap[]>(
			`${API_PREFIX}/integrations/upwork/sync-contracts`,
			syncContractsDto
		);
	}

	syncContractsRelatedData(dto) {
		return this.http.post<IIntegrationMap[]>(
			`${API_PREFIX}/integrations/upwork/sync-contracts-related-data`,
			dto
		);
	}

	getAllReports(dto): Observable<any> {
		const { integrationId, data } = dto;
		return this.http.get<any>(
			`${API_PREFIX}/integrations/upwork/report/${integrationId}`,
			{ params: { data } }
		);
	}

	/*
	 * Check remember state for upwork integration
	 */
	checkRemeberState(organizationId: string) {
		return this.http.get<any>(
			`${API_PREFIX}/integration/check/state/${IntegrationEnum.UPWORK}/${organizationId}`
		);
	}
}
