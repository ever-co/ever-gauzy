import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';
import type {
	IActivepiecesOAuthTokens,
	IActivepiecesConnection,
	ICreateActivepiecesIntegrationInput,
	IActivepiecesConnectionsListResponse,
	IActivepiecesConnectionsListParams,
	IActivepiecesMcpServer,
	IActivepiecesMcpServerPublic,
	IActivepiecesMcpServersListResponsePublic,
	IActivepiecesMcpServersListParams,
	IActivepiecesMcpServerUpdateRequest,
	ID,
	IIntegrationTenant,
	IIntegrationSetting
} from '@gauzy/contracts';

@Injectable({
	providedIn: 'root'
})
export class ActivepiecesService {
	constructor(private readonly http: HttpClient) {}

	/**
	 * Get ActivePieces OAuth configuration
	 */
	getConfig(): Observable<{ clientId: string; callbackUrl: string }> {
		return this.http.get<{ clientId: string; callbackUrl: string }>(
			`${API_PREFIX}/integration/activepieces/config`
		);
	}

	/**
	 * Initiate OAuth flow with ActivePieces
	 */
	authorize(tenantId: string, organizationId?: string): Observable<{
		authorizationUrl: string;
		state: string;
		tenantId: string;
		organizationId?: string;
	}> {
		let params = new HttpParams();
  		if (organizationId) params = params.set('organizationId', organizationId);

		return this.http.get<{
			authorizationUrl: string;
			state: string;
			tenantId: string;
			organizationId?: string;
		}>(`${API_PREFIX}/integration/activepieces/authorize`, { params });
	}

	/**
	 * Save OAuth settings (client ID and client secret)
	 */
	saveOAuthSettings(clientId: string, clientSecret: string, organizationId?: string): Observable<{
		message: string;
		integrationTenantId: string;
	}> {
		const body: { client_id: string; client_secret: string; organizationId?: string } = {
			client_id: clientId,
			client_secret: clientSecret
		};
		if (organizationId) {
			body.organizationId = organizationId;
		}
		return this.http.post<{ message: string; integrationTenantId: string }>(
			`${API_PREFIX}/integration/activepieces/oauth/settings`,
			body
		);
	}

	/**
	 * Exchange authorization code for access token
	 */
	exchangeToken(body: { code: string; state: string }): Observable<IActivepiecesOAuthTokens> {
		return this.http.post<IActivepiecesOAuthTokens>(`${API_PREFIX}/integration/activepieces/oauth/token`, body);
	}

	/**
	 * Create or update ActivePieces connection (upsert)
	 */
	upsertConnection(input: ICreateActivepiecesIntegrationInput): Observable<IActivepiecesConnection> {
		return this.http.post<IActivepiecesConnection>(`${API_PREFIX}/integration/activepieces/connection`, input);
	}

	/**
	 * Get ActivePieces connection details
	 */
	getConnection(integrationId: ID): Observable<IActivepiecesConnection | null> {
		return this.http.get<IActivepiecesConnection | null>(
			`${API_PREFIX}/integration/activepieces/connection/${integrationId}`
		);
	}

	/**
	 * List connections for a project
	 */
	listConnections(
		integrationId: ID,
		params: IActivepiecesConnectionsListParams
	): Observable<IActivepiecesConnectionsListResponse> {
		let httpParams = new HttpParams();

		if (params.projectId) httpParams = httpParams.set('projectId', params.projectId);
		if (params.cursor) httpParams = httpParams.set('cursor', params.cursor);
		if (params.scope) httpParams = httpParams.set('scope', params.scope);
		if (params.pieceName) httpParams = httpParams.set('pieceName', params.pieceName);
		if (params.displayName) httpParams = httpParams.set('displayName', params.displayName);
		if (params.status) httpParams = httpParams.set('status', params.status);
		if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());

		return this.http.get<IActivepiecesConnectionsListResponse>(
			`${API_PREFIX}/integration/activepieces/connections/${integrationId}`,
			{ params: httpParams }
		);
	}

	/**
	 * Get tenant connections
	 */
	getTenantConnections(integrationId: ID, projectId: string): Observable<IActivepiecesConnection[]> {
		return this.http.get<IActivepiecesConnection[]>(
			`${API_PREFIX}/integration/activepieces/connections/tenant/${integrationId}/${projectId}`
		);
	}

	/**
	 * Delete ActivePieces connection
	 */
	deleteConnection(integrationId: ID): Observable<void> {
		return this.http.delete<void>(`${API_PREFIX}/integration/activepieces/connection/${integrationId}`);
	}

	/**
	 * Check if ActivePieces integration is enabled
	 */
	getIntegrationStatus(integrationId: ID): Observable<{ enabled: boolean }> {
		return this.http.get<{ enabled: boolean }>(
			`${API_PREFIX}/integration/activepieces/status/${integrationId}`
		);
	}

	/**
	 * Get integration tenant information
	 */
	getIntegrationTenant(integrationId: ID): Observable<IIntegrationTenant> {
		return this.http.get<IIntegrationTenant>(
			`${API_PREFIX}/integration/activepieces/integration-tenant/${integrationId}`
		);
	}

	/**
	 * Get ActivePieces access token from integration settings
	 */
	getAccessToken(integrationId: ID): Observable<IIntegrationSetting> {
		return this.http.get<IIntegrationSetting>(
			`${API_PREFIX}/integration/activepieces/access-token/${integrationId}`
		);
	}

	/**
	 * List MCP servers for a project
	 */
	listMcpServers(
		integrationId: ID,
		params: IActivepiecesMcpServersListParams
	): Observable<IActivepiecesMcpServersListResponsePublic> {
		let httpParams = new HttpParams();

		if (params.projectId) httpParams = httpParams.set('projectId', params.projectId);
		if (params.cursor) httpParams = httpParams.set('cursor', params.cursor);
		if (params.name) httpParams = httpParams.set('name', params.name);
		if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());

		return this.http.get<IActivepiecesMcpServersListResponsePublic>(
			`${API_PREFIX}/integration/activepieces/mcp-servers/${integrationId}`,
			{ params: httpParams }
		);
	}

	/**
	 * Get MCP server details
	 */
	getMcpServer(integrationId: ID, serverId: string): Observable<IActivepiecesMcpServerPublic> {
		return this.http.get<IActivepiecesMcpServerPublic>(
			`${API_PREFIX}/integration/activepieces/mcp-server/${integrationId}/${serverId}`
		);
	}

	/**
	 * Create MCP server
	 */
	createMcpServer(
		integrationId: ID,
		data: { name: string; agentId: string }
	): Observable<IActivepiecesMcpServerPublic> {
		return this.http.post<IActivepiecesMcpServerPublic>(
			`${API_PREFIX}/integration/activepieces/mcp-server/${integrationId}`,
			data
		);
	}

	/**
	 * Update MCP server
	 */
	updateMcpServer(
		integrationId: ID,
		serverId: string,
		data: IActivepiecesMcpServerUpdateRequest
	): Observable<IActivepiecesMcpServerPublic> {
		return this.http.put<IActivepiecesMcpServerPublic>(
			`${API_PREFIX}/integration/activepieces/mcp-server/${integrationId}/${serverId}`,
			data
		);
	}

	/**
	 * Delete MCP server
	 */
	deleteMcpServer(integrationId: ID, serverId: string): Observable<void> {
		return this.http.delete<void>(
			`${API_PREFIX}/integration/activepieces/mcp-server/${integrationId}/${serverId}`
		);
	}
}
