import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { IMakeComIntegrationSettings } from '@gauzy/contracts';

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
	 * Update Make.com OAuth credentials
	 */
	updateOAuthSettings(credentials: {
		clientId: string;
		clientSecret: string;
	}): Observable<IMakeComIntegrationSettings> {
		return this.http.post<IMakeComIntegrationSettings>(
			`${API_PREFIX}/integration/make-com/oauth-settings`,
			credentials
		);
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
	 * Initiates the OAuth authorization flow
	 * Returns the URL to redirect the user to
	 */
	getAuthorizeUrl(state?: string): string {
		const baseUrl = `${API_PREFIX}/integration/make-com/oauth/authorize`;
		return state ? `${baseUrl}?state=${encodeURIComponent(state)}` : baseUrl;
	}

	/**
	 * Handles the redirect after OAuth authorization
	 * Note: This is generally handled by the controller, not directly called by the client
	 */
	handleOAuthCallback(code: string, state: string): Observable<any> {
		// This method might not be needed in the Angular service as the backend handles
		// the redirect automatically, but included for completeness
		return this.http.get(`${API_PREFIX}/integration/make-com/oauth/callback`, { params: { code, state } });
	}
}
