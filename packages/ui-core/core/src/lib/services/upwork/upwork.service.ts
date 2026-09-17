import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
	IAccessTokenSecretPair,
	IAccessTokenDto,
	IAccessToken,
	IEngagement,
	IGetContractsDto,
	IUpworkApiConfigStatus,
	IUpworkSyncContractsDto,
	IUpworkSyncContractsRelatedDataDto,
	IIntegrationMap,
	IUpworkClientSecretPair
} from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class UpworkService {
	constructor(private http: HttpClient) {}

	uploadTransaction(formData: FormData): Observable<any> {
		return this.http.post(`${API_PREFIX}/integrations/upwork/transactions`, formData);
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

	getAccessToken(accessTokenDto: IAccessTokenDto, organizationId: string): Observable<IAccessToken> {
		return this.http.post<IAccessToken>(
			`${API_PREFIX}/integrations/upwork/access-token/${organizationId}`,
			accessTokenDto
		);
	}

	/**
	 * Lists the freelancer contracts of an Upwork integration.
	 *
	 * Only the integration and organization travel: the API resolves the Upwork credentials itself,
	 * so they no longer sit in a request URL or in this app's memory (GHSA-3rqg-gpm9-gx84).
	 *
	 * @param dto - The integration and organization to read the contracts for.
	 * @returns The freelancer's Upwork engagements.
	 */
	getContracts({ integrationId, organizationId }: IGetContractsDto): Observable<IEngagement[]> {
		// Serialize an explicit allowlist, so no stray field of the caller's object reaches the URL.
		const data = JSON.stringify({ integrationId, organizationId });
		return this.http.get<IEngagement[]>(`${API_PREFIX}/integrations/upwork/freelancer-contracts`, {
			params: { data }
		});
	}

	/**
	 * Reads the non-secret configuration state of an Upwork integration.
	 *
	 * @param dto - The integration id and the serialized query filter.
	 * @returns Whether the integration is connected and usable. Never credential material.
	 */
	getConfig(dto): Observable<IUpworkApiConfigStatus> {
		const { integrationId, data } = dto;
		return this.http.get<IUpworkApiConfigStatus>(`${API_PREFIX}/integrations/upwork/config/${integrationId}`, {
			params: { data }
		});
	}

	/**
	 * Syncs Upwork contracts into projects of an organization.
	 *
	 * @param dto - The integration, organization and contracts to sync.
	 * @returns The integration maps produced by the sync.
	 */
	syncContracts({
		integrationId,
		organizationId,
		contracts
	}: IUpworkSyncContractsDto): Observable<IIntegrationMap[]> {
		return this.http.post<IIntegrationMap[]>(`${API_PREFIX}/integrations/upwork/sync-contracts`, {
			integrationId,
			organizationId,
			contracts
		});
	}

	/**
	 * Syncs the data hanging off a set of Upwork contracts.
	 *
	 * @param dto - The integration, organization, contracts and entities to sync. Carries no
	 *              credentials (GHSA-3rqg-gpm9-gx84).
	 * @returns The integration maps produced by the sync.
	 */
	syncContractsRelatedData({
		integrationId,
		organizationId,
		contracts,
		entitiesToSync,
		employeeId,
		providerId,
		providerReferenceId
	}: IUpworkSyncContractsRelatedDataDto) {
		// Post an explicit allowlist, so no stray field of the caller's object reaches the API.
		return this.http.post<IIntegrationMap[]>(`${API_PREFIX}/integrations/upwork/sync-contracts-related-data`, {
			integrationId,
			organizationId,
			contracts,
			entitiesToSync,
			employeeId,
			providerId,
			providerReferenceId
		});
	}

	getAllReports(dto): Observable<any> {
		const { integrationId, data } = dto;
		return this.http.get<any>(`${API_PREFIX}/integrations/upwork/report/${integrationId}`, { params: { data } });
	}
}
