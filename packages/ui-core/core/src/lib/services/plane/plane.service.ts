import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ID } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

export interface IPlaneSetupResponse {
	integrationTenantId: ID;
	apiKey: string;
	apiSecret: string;
}

export interface IPlaneSettingsResponse {
	integrationTenantId: ID;
	planeWebUrl: string;
	planeAdminUrl: string;
	planeSpaceUrl: string;
	isEnabled: boolean;
}

export interface IPlaneStatusResponse {
	isEnabled: boolean;
	integrationTenantId: ID | null;
}

export interface IPlaneUpdateResponse {
	integrationTenantId: ID;
	updated: boolean;
}

export interface IPlaneRegenerateKeyResponse {
	apiKey: string;
	apiSecret: string;
}

@Injectable({ providedIn: 'root' })
export class PlaneService {
	private readonly API_URL = `${API_PREFIX}/integration/plane`;

	constructor(private readonly http: HttpClient) {}

	/**
	 * Configure Plane integration with URLs.
	 */
	setup(
		dto: { planeWebUrl: string; planeAdminUrl?: string; planeSpaceUrl?: string },
		organizationId?: string
	): Observable<IPlaneSetupResponse> {
		const params = organizationId ? new HttpParams().set('organizationId', organizationId) : undefined;
		return this.http.post<IPlaneSetupResponse>(`${this.API_URL}/setup`, dto, { params });
	}

	/**
	 * Get Plane integration settings (no API key exposed).
	 */
	getSettings(organizationId?: string): Observable<IPlaneSettingsResponse> {
		const params = organizationId ? new HttpParams().set('organizationId', organizationId) : undefined;
		return this.http.get<IPlaneSettingsResponse>(`${this.API_URL}/settings`, { params });
	}

	/**
	 * Update Plane integration URL settings.
	 */
	updateSettings(
		dto: { planeWebUrl?: string; planeAdminUrl?: string; planeSpaceUrl?: string },
		organizationId?: string
	): Observable<IPlaneUpdateResponse> {
		const params = organizationId ? new HttpParams().set('organizationId', organizationId) : undefined;
		return this.http.put<IPlaneUpdateResponse>(`${this.API_URL}/settings`, dto, { params });
	}

	/**
	 * Remove Plane integration.
	 */
	removeIntegration(integrationTenantId: ID): Observable<{ success: boolean }> {
		return this.http.delete<{ success: boolean }>(`${this.API_URL}/${integrationTenantId}`);
	}

	/**
	 * Regenerate API key and secret.
	 */
	regenerateApiKey(organizationId?: string): Observable<IPlaneRegenerateKeyResponse> {
		const params = organizationId ? new HttpParams().set('organizationId', organizationId) : undefined;
		return this.http.post<IPlaneRegenerateKeyResponse>(`${this.API_URL}/regenerate-key`, null, { params });
	}

	/**
	 * Get integration status.
	 */
	getStatus(): Observable<IPlaneStatusResponse> {
		return this.http.get<IPlaneStatusResponse>(`${this.API_URL}/status`);
	}
}
