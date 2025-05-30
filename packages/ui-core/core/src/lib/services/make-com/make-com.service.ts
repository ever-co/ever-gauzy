import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { IMakeComIntegrationSettings, IMakeComCreateIntegration, IMakeComOAuthTokenDTO } from '@gauzy/contracts';

@Injectable({
	providedIn: 'root'
})
export class MakeComService {
	constructor(private readonly http: HttpClient) {}

	/**
	 * Get Make.com integration settings for the current tenant
	 */
	getIntegrationSettings(): Observable<IMakeComIntegrationSettings> {
		return this.http.get<IMakeComIntegrationSettings>(`${API_PREFIX}/integration/make-com`);
	}

	/**
	 * Update Make.com integration settings
	 */
	updateIntegrationSettings(settings: {
		isEnabled: boolean;
		webhookUrl: string;
	}): Observable<IMakeComIntegrationSettings> {
		return this.http.post<IMakeComIntegrationSettings>(`${API_PREFIX}/integration/make-com`, settings);
	}

	/**
	 * Add or update Make.com OAuth settings
	 */
	addOAuthSettings(credentials: IMakeComCreateIntegration): Observable<{
		authorizationUrl: string;
		integrationId: string;
	}> {
		return this.http.post<{
			authorizationUrl: string;
			integrationId: string;
		}>(`${API_PREFIX}/integration/make-com/oauth-settings`, {
			client_id: credentials.clientId,
			client_secret: credentials.clientSecret
		});
	}

	/**
	 * Get Make.com OAuth configuration
	 */
	getOAuthConfig(): Observable<{ clientId: string; redirectUri: string }> {
		return this.http.get<{ clientId: string; redirectUri: string }>(
			`${API_PREFIX}/integration/make-com/oauth-config`
		);
	}

	/**
	 * Handle OAuth callback from Make.com
	 */
	handleOAuthCallback(code: string, state: string): Observable<IMakeComOAuthTokenDTO> {
		return this.http.get<IMakeComOAuthTokenDTO>(`${API_PREFIX}/integration/make-com/oauth/callback`, {
			params: { code, state }
		});
	}

	/**
	 * Handle token requests from Make.com custom apps
	 */
	handleTokenRequest(body: {
		grant_type: string;
		code: string;
		state: string;
		client_id: string;
		client_secret: string;
		redirect_uri: string;
	}): Observable<IMakeComOAuthTokenDTO> {
		return this.http.post<IMakeComOAuthTokenDTO>(`${API_PREFIX}/integration/make-com/token`, body);
	}
}
