import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ID, IIntegrationTenant } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

/**
 * Represents a single SIM workflow execution record.
 */
export interface ISimExecutionRecord {
	id: string;
	workflowId: string;
	executionId?: string;
	status: string;
	triggeredBy?: string;
	duration?: number;
	createdAt: string;
	updatedAt?: string;
	result?: Record<string, unknown>;
}

/**
 * Paginated response for execution history.
 */
export interface ISimExecutionHistoryResponse {
	data: ISimExecutionRecord[];
	total: number;
}

/**
 * Result of a workflow execution (sync or async).
 */
export interface ISimWorkflowExecutionResult {
	executionId?: string;
	status?: string;
	result?: Record<string, unknown>;
	taskId?: string;
	metadata?: Record<string, unknown>;
	[key: string]: unknown;
}

/**
 * Async job status response.
 */
export interface ISimJobStatusResponse {
	taskId: string;
	status: string;
	result?: Record<string, unknown>;
	[key: string]: unknown;
}

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
	): Observable<ISimWorkflowExecutionResult> {
		return this.http.post<ISimWorkflowExecutionResult>(`${this.API_URL}/workflows/${workflowId}/execute`, body);
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
	getJobStatus(taskId: string): Observable<ISimJobStatusResponse> {
		return this.http.get<ISimJobStatusResponse>(`${this.API_URL}/jobs/${taskId}/status`);
	}

	/**
	 * Get workflow execution history.
	 */
	getExecutionHistory(query?: {
		workflowId?: string;
		status?: string;
		limit?: number;
		offset?: number;
	}): Observable<ISimExecutionHistoryResponse> {
		let params = new HttpParams();
		if (query?.workflowId) params = params.set('workflowId', query.workflowId);
		if (query?.status) params = params.set('status', query.status);
		if (query?.limit != null) params = params.set('limit', query.limit.toString());
		if (query?.offset != null) params = params.set('offset', query.offset.toString());
		return this.http.get<ISimExecutionHistoryResponse>(`${this.API_URL}/executions`, { params });
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
