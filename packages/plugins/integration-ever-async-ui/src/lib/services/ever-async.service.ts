import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ID } from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';

export interface IEverAsyncUserMapping {
	channel: 'slack' | 'discord';
	workspace: string;
	chatUserId: string;
	employeeId: ID;
}
export interface IEverAsyncSetupRequest {
	serverUrl: string;
	userMappings: IEverAsyncUserMapping[];
	projectIds: ID[];
}
export interface IEverAsyncSetupResponse {
	integrationTenantId: ID;
	tenantId: ID;
	organizationId: ID;
	apiKey: string;
	apiSecret: string;
}
export interface IEverAsyncSettingsResponse extends IEverAsyncSetupRequest {
	integrationTenantId: ID;
	tenantId: ID;
	organizationId: ID;
	isEnabled: boolean;
	hasApiKey: boolean;
}
export interface IEverAsyncStatusResponse {
	isEnabled: boolean;
	integrationTenantId: ID | null;
}
export interface IEverAsyncUpdateResponse {
	integrationTenantId: ID;
	updated: boolean;
}
export interface IEverAsyncVerifyResponse {
	ok: boolean;
	serverUrl: string;
}
export interface IEverAsyncOptions {
	employees: { id: ID; name: string }[];
	projects: { id: ID; name: string }[];
}

@Injectable({ providedIn: 'root' })
export class EverAsyncService {
	private readonly apiUrl = `${API_PREFIX}/integration/ever-async`;
	constructor(private readonly http: HttpClient) {}
	private options(organizationId: ID) {
		return { params: new HttpParams().set('organizationId', organizationId) };
	}
	setup(dto: IEverAsyncSetupRequest, organizationId: ID): Observable<IEverAsyncSetupResponse> {
		return this.http.post<IEverAsyncSetupResponse>(`${this.apiUrl}/setup`, dto, this.options(organizationId));
	}
	getSettings(organizationId: ID): Observable<IEverAsyncSettingsResponse> {
		return this.http.get<IEverAsyncSettingsResponse>(`${this.apiUrl}/settings`, this.options(organizationId));
	}
	getOptions(organizationId: ID): Observable<IEverAsyncOptions> {
		return this.http.get<IEverAsyncOptions>(`${this.apiUrl}/options`, this.options(organizationId));
	}
	updateSettings(
		dto: Partial<IEverAsyncSetupRequest> & { isEnabled?: boolean },
		organizationId: ID
	): Observable<IEverAsyncUpdateResponse> {
		return this.http.put<IEverAsyncUpdateResponse>(`${this.apiUrl}/settings`, dto, this.options(organizationId));
	}
	rotateCredentials(organizationId: ID): Observable<IEverAsyncSetupResponse> {
		return this.http.post<IEverAsyncSetupResponse>(
			`${this.apiUrl}/credentials/rotate`,
			{},
			this.options(organizationId)
		);
	}
	verify(serverUrl: string): Observable<IEverAsyncVerifyResponse> {
		return this.http.post<IEverAsyncVerifyResponse>(`${this.apiUrl}/verify`, { serverUrl });
	}
	getStatus(organizationId: ID): Observable<IEverAsyncStatusResponse> {
		return this.http.get<IEverAsyncStatusResponse>(`${this.apiUrl}/status`, this.options(organizationId));
	}
	remove(integrationTenantId: ID, organizationId: ID): Observable<{ success: boolean }> {
		return this.http.delete<{ success: boolean }>(
			`${this.apiUrl}/${integrationTenantId}`,
			this.options(organizationId)
		);
	}
}
