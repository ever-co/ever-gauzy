import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, switchMap } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';
import {
	IZapierEndpoint,
	IZapierOAuthTokenDTO,
	ICreateZapierIntegrationInput,
	IZapierWebhook,
	IZapierCreateWebhookInput,
	IZapierAuthConfig,
	IZapierIntegrationSettings,
	IIntegrationSetting,
	ID
} from '@gauzy/contracts';

@Injectable({
	providedIn: 'root'
})
export class ZapierService {
	constructor(private readonly http: HttpClient) {}

	/**
	 * Get OAuth configuration
	 */
	getOAuthConfig(): Observable<IZapierAuthConfig> {
		return this.http.get<IZapierAuthConfig>(`${API_PREFIX}/integration/zapier/oauth/config`);
	}

	/**
	 * Get Zapier integration settings
	 */
	getSettings(): Observable<IZapierIntegrationSettings> {
		return this.http.get<IZapierIntegrationSettings>(`${API_PREFIX}/integration/zapier/settings`);
	}

	/**
	 * Get Zapier access token for a given integration
	 */
	getZapierToken(integrationId: string): Observable<IIntegrationSetting> {
		return this.http.get<IIntegrationSetting>(`${API_PREFIX}/integration/zapier/token/${integrationId}`);
	}

	/**
	 * Extract and return the OAuth access token from integration settings
	 * Handles different token storage formats (JSON string, object, or direct string)
	 */
	getAccessToken(integrationId: ID): Observable<string> {
		return this.getZapierToken(integrationId).pipe(
			switchMap((integrationSetting: IIntegrationSetting) => {
				if (!integrationSetting || !integrationSetting.settingsValue) {
					throw new Error('Integration setting found but access token value is missing');
				}

				let accessToken: string;
				try {
					const tokenData =
						typeof integrationSetting.settingsValue === 'string'
							? JSON.parse(integrationSetting.settingsValue)
							: integrationSetting.settingsValue;
					accessToken = tokenData.access_token || tokenData;
				} catch (parseError) {
					accessToken = integrationSetting.settingsValue as string;
				}

				if (!accessToken) {
					throw new Error('Access token is empty or invalid');
				}

				return of(accessToken);
			})
		);
	}

	/**
	 * Update Zapier integration settings
	 */
	updateSettings(settings: IZapierIntegrationSettings): Observable<IZapierIntegrationSettings> {
		return this.http.put<IZapierIntegrationSettings>(`${API_PREFIX}/integration/zapier/settings`, settings);
	}

	/**
	 * Initialize a new Zapier integration
	 */
	initializeIntegration(body: ICreateZapierIntegrationInput): Observable<{
		authorizationUrl: string;
		integrationId: string;
	}> {
		return this.http.post<{ authorizationUrl: string; integrationId: string }>(
			`${API_PREFIX}/integration/zapier/settings`,
			body
		);
	}

	/**
	 * Get available Zapier triggers
	 */
	getTriggers(token: string): Observable<IZapierEndpoint[]> {
		return this.http.get<IZapierEndpoint[]>(`${API_PREFIX}/integration/zapier/triggers`, {
			params: { token }
		});
	}

	/**
	 * Get available Zapier actions
	 */
	getActions(token: string): Observable<IZapierEndpoint[]> {
		return this.http.get<IZapierEndpoint[]>(`${API_PREFIX}/integration/zapier/actions`, {
			params: { token }
		});
	}

	/**
	 * Exchange authorization code for tokens
	 */
	exchangeCodeForToken(body: {
		code: string;
		client_id: string;
		client_secret: string;
		redirect_uri: string;
		grant_type: string;
	}): Observable<IZapierOAuthTokenDTO> {
		return this.http.post<IZapierOAuthTokenDTO>(`${API_PREFIX}/integration/zapier/token`, body);
	}

	/**
	 * Refresh access token
	 */
	refreshAccessToken(body: {
		refresh_token: string;
		client_id: string;
		client_secret: string;
		grant_type: string;
	}): Observable<IZapierOAuthTokenDTO> {
		return this.http.post<IZapierOAuthTokenDTO>(`${API_PREFIX}/integration/zapier/refresh-token`, body);
	}

	/**
	 * Initiate OAuth2 authorization with Zapier
	 */
	authorize(state: string): Observable<{ url: string }> {
		return this.http.get<{ url: string }>(`${API_PREFIX}/integration/zapier/oauth/authorize`, {
			params: { state }
		});
	}

	/**
	 * Get all webhooks
	 */
	getWebhooks(token: string): Observable<IZapierWebhook[]> {
		return this.http.get<IZapierWebhook[]>(`${API_PREFIX}/integration/zapier/webhooks`, {
			headers: {
				Authorization: `Bearer ${token}`
			}
		});
	}

	/**
	 * Create a new Zapier webhook subscription
	 */
	createWebhook(body: IZapierCreateWebhookInput, token: string): Observable<IZapierWebhook> {
		return this.http.post<IZapierWebhook>(`${API_PREFIX}/integration/zapier/webhooks`, body, {
			headers: {
				Authorization: `Bearer ${token}`
			}
		});
	}

	/**
	 * Delete an existing Zapier webhook subscription
	 */
	deleteWebhook(id: string, token: string): Observable<void> {
		return this.http.delete<void>(`${API_PREFIX}/integration/zapier/webhooks/${id}`, {
			headers: {
				Authorization: `Bearer ${token}`
			}
		});
	}
}
