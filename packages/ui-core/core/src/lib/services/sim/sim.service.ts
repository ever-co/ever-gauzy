import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ID, IIntegrationTenant } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({ providedIn: 'root' })
export class SimService {
	private readonly API_URL = `${API_PREFIX}/integration/sim`;

	constructor(private readonly http: HttpClient) {}

	/**
	 * Configure SIM integration with API key.
	 */
	setup(apiKey: string, organizationId?: string): Observable<{ integrationTenantId: string }> {
		const params = organizationId ? new HttpParams().set('organizationId', organizationId) : undefined;
		return this.http.post<{ integrationTenantId: string }>(`${this.API_URL}/setup`, { apiKey }, { params });
	}

	/**
	 * Get SIM integration settings (sanitized, no API key exposed).
	 */
	getSettings(): Observable<{ isEnabled: boolean; hasApiKey: boolean }> {
		return this.http.get<{ isEnabled: boolean; hasApiKey: boolean }>(`${this.API_URL}/settings`);
	}

	/**
	 * Execute a SIM workflow.
	 */
	executeWorkflow(
		workflowId: string,
		body: { input?: unknown; timeout?: number; runAsync?: boolean }
	): Observable<any> {
		return this.http.post<any>(`${this.API_URL}/workflows/${workflowId}/execute`, body);
	}

	/**
	 * Validate a workflow is deployed and ready.
	 */
	validateWorkflow(workflowId: string): Observable<{ workflowId: string; isDeployed: boolean }> {
		return this.http.get<{ workflowId: string; isDeployed: boolean }>(
			`${this.API_URL}/workflows/${workflowId}/validate`
		);
	}

	/**
	 * Get async job status.
	 */
	getJobStatus(taskId: string): Observable<any> {
		return this.http.get<any>(`${this.API_URL}/jobs/${taskId}/status`);
	}

	/**
	 * Get workflow execution history.
	 */
	getExecutionHistory(query?: {
		workflowId?: string;
		status?: string;
		limit?: number;
		offset?: number;
	}): Observable<{ data: any[]; total: number }> {
		let params = new HttpParams();
		if (query?.workflowId) params = params.set('workflowId', query.workflowId);
		if (query?.status) params = params.set('status', query.status);
		if (query?.limit != null) params = params.set('limit', query.limit.toString());
		if (query?.offset != null) params = params.set('offset', query.offset.toString());
		return this.http.get<{ data: any[]; total: number }>(`${this.API_URL}/executions`, { params });
	}

	/**
	 * Check if SIM integration is enabled.
	 */
	getIntegrationStatus(integrationTenantId: ID): Observable<{ enabled: boolean }> {
		return this.http.get<{ enabled: boolean }>(`${this.API_URL}/status/${integrationTenantId}`);
	}

	/**
	 * Get integration tenant information (with sensitive settings redacted).
	 */
	getIntegrationTenant(integrationTenantId: ID): Observable<IIntegrationTenant> {
		return this.http.get<IIntegrationTenant>(`${this.API_URL}/integration-tenant/${integrationTenantId}`);
	}
}
