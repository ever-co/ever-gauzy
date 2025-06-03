import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { IZapierEndpoint, IZapierAccessTokens, ICreateZapierIntegrationInput } from '@gauzy/contracts';

@Injectable({
	providedIn: 'root'
})
export class ZapierService {
	constructor(private readonly http: HttpClient) {}

	/**
	 * Get OAuth configuration
	 */
	getOAuthConfig(): Observable<{ clientId: string; redirectUri: string }> {
		return this.http.get<{ clientId: string; redirectUri: string }>(
			`${API_PREFIX}/integration/zapier/oauth/config`
		);
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
	}): Observable<IZapierAccessTokens> {
		return this.http.post<IZapierAccessTokens>(`${API_PREFIX}/integration/zapier/token`, body);
	}

	/**
	 * Refresh access token
	 */
	refreshAccessToken(body: {
		refresh_token: string;
		client_id: string;
		client_secret: string;
		grant_type: string;
	}): Observable<IZapierAccessTokens> {
		return this.http.post<IZapierAccessTokens>(`${API_PREFIX}/integration/zapier/refresh-token`, body);
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
	 * Create a new Zapier webhook subscription
	 */
	createWebhook(body: { target_url: string; event: string }, token: string): Observable<any> {
		return this.http.post(`${API_PREFIX}/integration/zapier/webhooks`, body, {
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
