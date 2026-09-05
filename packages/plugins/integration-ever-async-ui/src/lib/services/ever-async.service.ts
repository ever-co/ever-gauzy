import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ID } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

/**
 * HTTP client for the `@gauzy/plugin-integration-ever-async` backend
 * (`/api/integration/ever-async`).
 *
 * scaffold: kept package-local so this PR stays purely additive. When wiring,
 * consider promoting it to `packages/ui-core/core/src/lib/services/ever-async/`
 * (mirroring `PlaneService`) and exporting it from `@gauzy/ui-core/core`.
 */

export interface IEverAsyncUserMapping {
	chatUserId: string;
	employeeId: ID;
}

export interface IEverAsyncSetupRequest {
	serverUrl: string;
	/** Write-only: stored by the backend, never returned by read endpoints. */
	apiToken: string;
	userMappings?: IEverAsyncUserMapping[];
}

export interface IEverAsyncSetupResponse {
	integrationTenantId: ID;
}

export interface IEverAsyncSettingsResponse {
	integrationTenantId: ID;
	serverUrl: string;
	userMappings: IEverAsyncUserMapping[];
	isEnabled: boolean;
	hasApiToken: boolean;
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

@Injectable({ providedIn: 'root' })
export class EverAsyncService {
	private readonly API_URL = `${API_PREFIX}/integration/ever-async`;

	constructor(private readonly http: HttpClient) {}

	/**
	 * Configure the Ever Async integration (server URL + write-only API token + mappings).
	 */
	setup(dto: IEverAsyncSetupRequest, organizationId?: string): Observable<IEverAsyncSetupResponse> {
		let params = new HttpParams();
		if (organizationId) {
			params = params.set('organizationId', organizationId);
		}
		return this.http.post<IEverAsyncSetupResponse>(`${this.API_URL}/setup`, dto, { params });
	}

	/**
	 * Get the current settings (the API token is never returned).
	 */
	getSettings(organizationId?: string): Observable<IEverAsyncSettingsResponse> {
		let params = new HttpParams();
		if (organizationId) {
			params = params.set('organizationId', organizationId);
		}
		return this.http.get<IEverAsyncSettingsResponse>(`${this.API_URL}/settings`, { params });
	}

	/**
	 * Partially update the settings.
	 */
	updateSettings(
		dto: Partial<IEverAsyncSetupRequest>,
		organizationId?: string
	): Observable<IEverAsyncUpdateResponse> {
		let params = new HttpParams();
		if (organizationId) {
			params = params.set('organizationId', organizationId);
		}
		return this.http.put<IEverAsyncUpdateResponse>(`${this.API_URL}/settings`, dto, { params });
	}

	/**
	 * Verify connectivity to an Ever Async server (`/healthz` ping).
	 * Omit `serverUrl` to verify the stored configuration.
	 */
	verify(serverUrl?: string): Observable<IEverAsyncVerifyResponse> {
		return this.http.post<IEverAsyncVerifyResponse>(`${this.API_URL}/verify`, serverUrl ? { serverUrl } : {});
	}

	/**
	 * Integration status for the current tenant.
	 */
	getStatus(): Observable<IEverAsyncStatusResponse> {
		return this.http.get<IEverAsyncStatusResponse>(`${this.API_URL}/status`);
	}

	/**
	 * Remove (soft-archive) the integration.
	 */
	remove(integrationTenantId: ID): Observable<{ success: boolean }> {
		return this.http.delete<{ success: boolean }>(`${this.API_URL}/${integrationTenantId}`);
	}
}
