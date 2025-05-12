import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IMakeComApiConfig } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class MakeComService {
	constructor(private readonly http: HttpClient) {}

	/**
	 * Get Make.com API configuration
	 */
	getConfig(input: { integrationId: string; data: string }): Observable<IMakeComApiConfig> {
		const { integrationId, data } = input;
		return this.http.get<IMakeComApiConfig>(`${API_PREFIX}/integrations/make-com/config/${integrationId}`, {
			params: { data }
		});
	}

	/**
	 * Get all webhooks
	 */
	getAllWebhooks(input: { integrationId: string; data: string }): Observable<any> {
		const { integrationId, data } = input;
		return this.http.get(`${API_PREFIX}/integrations/make-com/webhooks/${integrationId}`, {
			params: { data }
		});
	}

	/**
	 * Get all scenarios
	 */
	getAllScenarios(input: { integrationId: string; data: string }): Observable<any> {
		const { integrationId, data } = input;
		return this.http.get(`${API_PREFIX}/integrations/make-com/scenarios/${integrationId}`, {
			params: { data }
		});
	}

	/**
	 * Create a new webhook
	 */
	createWebhook(input: { integrationId: string; data: any }): Observable<any> {
		const { integrationId, data } = input;
		return this.http.post(`${API_PREFIX}/integrations/make-com/webhooks/${integrationId}`, data);
	}

	/**
	 * Delete a webhook
	 */
	deleteWebhook(input: { integrationId: string; webhookId: string }): Observable<any> {
		const { integrationId, webhookId } = input;
		return this.http.delete(`${API_PREFIX}/integrations/make-com/webhooks/${integrationId}/${webhookId}`);
	}

	/**
	 * Create a new scenario
	 */
	createScenario(input: { integrationId: string; data: any }): Observable<any> {
		const { integrationId, data } = input;
		return this.http.post(`${API_PREFIX}/integrations/make-com/scenarios/${integrationId}`, data);
	}

	/**
	 * Delete a scenario
	 */
	deleteScenario(input: { integrationId: string; scenarioId: string }): Observable<any> {
		const { integrationId, scenarioId } = input;
		return this.http.delete(`${API_PREFIX}/integrations/make-com/scenarios/${integrationId}/${scenarioId}`);
	}
}
