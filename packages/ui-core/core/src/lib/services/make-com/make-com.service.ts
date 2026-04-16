import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_PREFIX } from '@gauzy/ui-core/common';
import {
	IMakeComIntegrationSettings,
	IMakeComOAuthTokenDTO,
	IMakeComOrganization,
	IMakeComTeam,
	IMakeComConnection,
	IMakeComScenario,
	IMakeComHook,
	IMakeComTemplate,
	IMakeComSetupStatus,
	MakeComZone
} from '@gauzy/contracts';

@Injectable({
	providedIn: 'root'
})
export class MakeComService {
	private readonly API_URL = `${API_PREFIX}/integration/make-com`;
	private readonly API_BASE = `${this.API_URL}/api`;

	constructor(private readonly http: HttpClient) {}

	// ─── Settings & Auth ────────────────────────────────────────────────────

	getIntegrationSettings(): Observable<IMakeComIntegrationSettings> {
		return this.http.get<IMakeComIntegrationSettings>(this.API_URL);
	}

	updateIntegrationSettings(settings: {
		isEnabled: boolean;
		webhookUrl: string;
	}): Observable<IMakeComIntegrationSettings> {
		return this.http.post<IMakeComIntegrationSettings>(this.API_URL, settings);
	}

	initializeIntegration(body: { organizationId: string }): Observable<{
		authorizationUrl: string;
		integrationId: string;
	}> {
		return this.http.post<{
			authorizationUrl: string;
			integrationId: string;
		}>(`${this.API_URL}/oauth-settings`, body);
	}

	handleOAuthCallback(code: string, state: string): Observable<IMakeComOAuthTokenDTO> {
		return this.http.get<IMakeComOAuthTokenDTO>(`${this.API_URL}/oauth/callback`, {
			params: { code, state }
		});
	}

	handleTokenRequest(body: {
		grant_type: string;
		code: string;
		state: string;
		client_id: string;
		client_secret: string;
		redirect_uri: string;
	}): Observable<IMakeComOAuthTokenDTO> {
		return this.http.post<IMakeComOAuthTokenDTO>(`${this.API_URL}/token`, body);
	}

	// ─── Setup Status ───────────────────────────────────────────────────────

	getSetupStatus(organizationId?: string): Observable<IMakeComSetupStatus> {
		const params: any = {};
		if (organizationId) params.organizationId = organizationId;
		return this.http.get<IMakeComSetupStatus>(`${this.API_BASE}/setup-status`, { params });
	}

	// ─── Zone Configuration ─────────────────────────────────────────────────

	getZone(organizationId?: string): Observable<MakeComZone | null> {
		const params: any = {};
		if (organizationId) params.organizationId = organizationId;
		return this.http.get<{ zone: MakeComZone | null }>(`${this.API_BASE}/zone`, { params }).pipe(
			map((res) => res.zone)
		);
	}

	setZone(zone: MakeComZone, organizationId?: string): Observable<{ success: boolean; zone: MakeComZone }> {
		return this.http.post<{ success: boolean; zone: MakeComZone }>(`${this.API_BASE}/zone`, {
			zone,
			organizationId
		});
	}

	// ─── Context (Make.com org/team selection) ──────────────────────────────

	setMakeOrganization(
		makeOrganizationId: number,
		organizationId?: string
	): Observable<{ success: boolean; makeOrganizationId: number }> {
		return this.http.post<{ success: boolean; makeOrganizationId: number }>(
			`${this.API_BASE}/context/organization`,
			{ makeOrganizationId, organizationId }
		);
	}

	setMakeTeam(
		makeTeamId: number,
		organizationId?: string
	): Observable<{ success: boolean; makeTeamId: number }> {
		return this.http.post<{ success: boolean; makeTeamId: number }>(`${this.API_BASE}/context/team`, {
			makeTeamId,
			organizationId
		});
	}

	// ─── Organizations ──────────────────────────────────────────────────────

	listOrganizations(organizationId?: string): Observable<IMakeComOrganization[]> {
		const params: any = {};
		if (organizationId) params.organizationId = organizationId;
		return this.http
			.get<{ organizations: IMakeComOrganization[] }>(`${this.API_BASE}/organizations`, { params })
			.pipe(map((res) => res.organizations));
	}

	// ─── Teams ──────────────────────────────────────────────────────────────

	listTeams(makeOrgId?: number, organizationId?: string): Observable<IMakeComTeam[]> {
		const params: any = {};
		if (makeOrgId) params.makeOrgId = makeOrgId;
		if (organizationId) params.organizationId = organizationId;
		return this.http.get<{ teams: IMakeComTeam[] }>(`${this.API_BASE}/teams`, { params }).pipe(
			map((res) => res.teams)
		);
	}

	// ─── Connections ────────────────────────────────────────────────────────

	listConnections(teamId?: number, organizationId?: string): Observable<IMakeComConnection[]> {
		const params: any = {};
		if (teamId) params.teamId = teamId;
		if (organizationId) params.organizationId = organizationId;
		return this.http
			.get<{ connections: IMakeComConnection[] }>(`${this.API_BASE}/connections`, { params })
			.pipe(map((res) => res.connections));
	}

	deleteConnection(id: number, organizationId?: string): Observable<void> {
		const params: any = {};
		if (organizationId) params.organizationId = organizationId;
		return this.http.delete<void>(`${this.API_BASE}/connections/${id}`, { params });
	}

	testConnection(id: number, organizationId?: string): Observable<any> {
		const params: any = {};
		if (organizationId) params.organizationId = organizationId;
		return this.http.post<any>(`${this.API_BASE}/connections/${id}/test`, null, { params });
	}

	// ─── Scenarios ──────────────────────────────────────────────────────────

	listScenarios(teamId?: number, organizationId?: string): Observable<IMakeComScenario[]> {
		const params: any = {};
		if (teamId) params.teamId = teamId;
		if (organizationId) params.organizationId = organizationId;
		return this.http
			.get<{ scenarios: IMakeComScenario[] }>(`${this.API_BASE}/scenarios`, { params })
			.pipe(map((res) => res.scenarios));
	}

	getScenario(id: number, organizationId?: string): Observable<IMakeComScenario> {
		const params: any = {};
		if (organizationId) params.organizationId = organizationId;
		return this.http
			.get<{ scenario: IMakeComScenario }>(`${this.API_BASE}/scenarios/${id}`, { params })
			.pipe(map((res) => res.scenario));
	}

	startScenario(id: number, organizationId?: string): Observable<IMakeComScenario> {
		const params: any = {};
		if (organizationId) params.organizationId = organizationId;
		return this.http
			.post<{ scenario: IMakeComScenario }>(`${this.API_BASE}/scenarios/${id}/start`, null, { params })
			.pipe(map((res) => res.scenario));
	}

	stopScenario(id: number, organizationId?: string): Observable<IMakeComScenario> {
		const params: any = {};
		if (organizationId) params.organizationId = organizationId;
		return this.http
			.post<{ scenario: IMakeComScenario }>(`${this.API_BASE}/scenarios/${id}/stop`, null, { params })
			.pipe(map((res) => res.scenario));
	}

	runScenario(id: number, organizationId?: string): Observable<any> {
		const params: any = {};
		if (organizationId) params.organizationId = organizationId;
		return this.http.post<any>(`${this.API_BASE}/scenarios/${id}/run`, null, { params });
	}

	deleteScenario(id: number, organizationId?: string): Observable<void> {
		const params: any = {};
		if (organizationId) params.organizationId = organizationId;
		return this.http.delete<void>(`${this.API_BASE}/scenarios/${id}`, { params });
	}

	// ─── Hooks (Webhooks) ───────────────────────────────────────────────────

	listHooks(teamId?: number, organizationId?: string): Observable<IMakeComHook[]> {
		const params: any = {};
		if (teamId) params.teamId = teamId;
		if (organizationId) params.organizationId = organizationId;
		return this.http.get<{ hooks: IMakeComHook[] }>(`${this.API_BASE}/hooks`, { params }).pipe(
			map((res) => res.hooks)
		);
	}

	enableHook(id: number, organizationId?: string): Observable<any> {
		const params: any = {};
		if (organizationId) params.organizationId = organizationId;
		return this.http.post<any>(`${this.API_BASE}/hooks/${id}/enable`, null, { params });
	}

	disableHook(id: number, organizationId?: string): Observable<any> {
		const params: any = {};
		if (organizationId) params.organizationId = organizationId;
		return this.http.post<any>(`${this.API_BASE}/hooks/${id}/disable`, null, { params });
	}

	pingHook(id: number, organizationId?: string): Observable<any> {
		const params: any = {};
		if (organizationId) params.organizationId = organizationId;
		return this.http.get<any>(`${this.API_BASE}/hooks/${id}/ping`, { params });
	}

	deleteHook(id: number, organizationId?: string): Observable<void> {
		const params: any = {};
		if (organizationId) params.organizationId = organizationId;
		return this.http.delete<void>(`${this.API_BASE}/hooks/${id}`, { params });
	}

	// ─── Templates ──────────────────────────────────────────────────────────

	listTemplates(teamId?: number, organizationId?: string): Observable<IMakeComTemplate[]> {
		const params: any = {};
		if (teamId) params.teamId = teamId;
		if (organizationId) params.organizationId = organizationId;
		return this.http
			.get<{ templates: IMakeComTemplate[] }>(`${this.API_BASE}/templates`, { params })
			.pipe(map((res) => res.templates));
	}
}
