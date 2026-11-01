import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, switchMap } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';
import {
	IZapierEndpoint,
	IZapierOAuthTokenDTO,
	IZapierWebhook,
	IZapierCreateWebhookInput,
	IZapierAuthConfig,
	IZapierIntegrationSettings,
	IIntegrationSetting,
	IZapierZap,
	IZapierCreateZapInput,
	IZapierZapTemplate,
	ID
} from '@gauzy/contracts';

@Injectable({
	providedIn: 'root'
})
export class ZapierService {
	constructor(private readonly http: HttpClient) {}

	/**
	 * Get the OAuth configuration the API exposes: client ID, redirect URI, post-install URL and scopes (never the secret)
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
	 * Update Zapier integration settings (of the selected organization's integration: the API reads the
	 * `Organization-Id` header the tenant interceptor sends)
	 */
	updateSettings(settings: IZapierIntegrationSettings): Observable<IZapierIntegrationSettings> {
		return this.http.put<IZapierIntegrationSettings>(`${API_PREFIX}/integration/zapier/settings`, settings);
	}

	/**
	 * Initialize a new Zapier integration.
	 * No client credentials needed — server uses its own env-configured credentials.
	 */
	initializeIntegration(body: { organizationId: string }): Observable<{
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
	getTriggers(token: string, integrationId?: ID | null): Observable<IZapierEndpoint[]> {
		return this.http.get<IZapierEndpoint[]>(`${API_PREFIX}/integration/zapier/triggers`, {
			headers: {
				Authorization: `Bearer ${token}`
			},
			params: this._tokenParams(token, integrationId)
		});
	}

	/**
	 * Get available Zapier actions
	 */
	getActions(token: string, integrationId?: ID | null): Observable<IZapierEndpoint[]> {
		return this.http.get<IZapierEndpoint[]>(`${API_PREFIX}/integration/zapier/actions`, {
			headers: {
				Authorization: `Bearer ${token}`
			},
			params: this._tokenParams(token, integrationId)
		});
	}

	/**
	 * Get Zaps for the authenticated Zapier account
	 */
	getZaps(token: string, integrationId?: ID | null): Observable<IZapierZap[]> {
		return this.http.get<IZapierZap[]>(`${API_PREFIX}/integration/zapier/zaps`, {
			headers: {
				Authorization: `Bearer ${token}`
			},
			params: this._tokenParams(token, integrationId)
		});
	}

	/**
	 * Create a new Zap on the authenticated Zapier account
	 */
	createZap(body: IZapierCreateZapInput, token: string, integrationId?: ID | null): Observable<IZapierZap> {
		return this.http.post<IZapierZap>(`${API_PREFIX}/integration/zapier/zaps`, body, {
			headers: {
				Authorization: `Bearer ${token}`
			},
			params: this._tokenParams(token, integrationId)
		});
	}

	/**
	 * Query params the API reads the Zapier token from. With an integration ID the API loads the
	 * stored token itself, because the token endpoint only returns a masked value to the browser.
	 */
	private _tokenParams(token: string, integrationId?: ID | null): Record<string, string> {
		return integrationId ? { integrationId } : { token };
	}

	/**
	 * Get publicly available Zap templates.
	 * Zap templates do not require an OAuth access token — the server attaches
	 * the configured `client_id` on the way out to Zapier.
	 */
	getZapTemplates(limit?: number): Observable<IZapierZapTemplate[]> {
		const params: Record<string, string> = {};
		if (limit !== undefined) {
			params['limit'] = String(limit);
		}
		return this.http.get<IZapierZapTemplate[]>(`${API_PREFIX}/integration/zapier/zap-templates`, {
			params
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
		return this.http.post<IZapierOAuthTokenDTO>(`${API_PREFIX}/integration/zapier/oauth/token`, body);
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
		return this.http.post<IZapierOAuthTokenDTO>(`${API_PREFIX}/integration/zapier/oauth/refresh-token`, body);
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
	 * Get the webhook subscriptions of an integration.
	 * With an integration ID the API reads the integration in the user's tenant: the token interceptor sends the user's
	 * session as `Authorization`, whatever this method sets, so the token alone cannot name the integration.
	 */
	getWebhooks(token: string, integrationId?: ID | null): Observable<IZapierWebhook[]> {
		return this.http.get<IZapierWebhook[]>(`${API_PREFIX}/integration/zapier/webhooks`, {
			headers: {
				Authorization: `Bearer ${token}`
			},
			params: integrationId ? { integrationId } : {}
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
	 * Delete an existing Zapier webhook subscription (of the integration named, when one is; see `getWebhooks`)
	 */
	deleteWebhook(id: string, token: string, integrationId?: ID | null): Observable<void> {
		return this.http.delete<void>(`${API_PREFIX}/integration/zapier/webhooks/${encodeURIComponent(id)}`, {
			headers: {
				Authorization: `Bearer ${token}`
			},
			params: integrationId ? { integrationId } : {}
		});
	}
}
