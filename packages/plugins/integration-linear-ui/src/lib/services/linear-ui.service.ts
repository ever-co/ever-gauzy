import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';

const BASE = `${API_PREFIX}/integration/linear`;

export interface LinearConnectionSummary {
	id: string;
	organizationId: string;
	linearOrganizationId: string | null;
	linearOrganizationName: string | null;
	linearOrganizationUrlKey: string | null;
	connectedByUserId: string | null;
	attentionReason: string | null;
	lastSyncedAt: string | null;
	createdAt: string | null;
}

export interface LinearStatus {
	configured: boolean;
	defaultStateMap: Record<string, string>;
	connection: LinearConnectionSummary | null;
}

export interface LinearTeam {
	id: string;
	key: string;
	name: string;
}

export interface LinearTeamDetail {
	team: LinearTeam;
	states: Array<{ id: string; name: string; type: string; position: number }>;
	labels: Array<{ id: string; name: string; color: string | null }>;
}

export type LinearDirection = 'inbound' | 'outbound' | 'both';

export interface LinearMapping {
	id: string;
	integrationId: string;
	linearTeamId: string;
	linearTeamKey: string | null;
	linearTeamName: string | null;
	projectId: string;
	direction: LinearDirection;
	stateMap: Record<string, string>;
	syncEnabled: boolean;
	lastImportedAt: string | null;
	lastCursor: string | null;
	lastError: string | null;
}

export interface LinearMappingInput {
	linearTeamId: string;
	linearTeamKey?: string | null;
	linearTeamName?: string | null;
	projectId: string;
	direction?: LinearDirection;
	stateMap?: Record<string, string> | null;
	syncEnabled?: boolean;
}

export interface LinearRun {
	id: string;
	mappingId: string | null;
	kind: 'import' | 'webhook';
	status: 'running' | 'done' | 'failed';
	full: boolean;
	startedAt: string | null;
	finishedAt: string | null;
	createdCount: number;
	updatedCount: number;
	skippedCount: number;
	failedCount: number;
	lastError: string | null;
}

/** The HTTP client of the Linear integration's routes (`/api/integration/linear`). */
@Injectable({ providedIn: 'root' })
export class LinearUiService {
	private readonly http = inject(HttpClient);

	private connection(integrationId: string): string {
		return `${BASE}/${encodeURIComponent(integrationId)}`;
	}

	/** Whether the server is configured, and the organization's connection if any (404 when the plugin is not loaded). */
	status(organizationId: string): Observable<LinearStatus> {
		return this.http.get<LinearStatus>(`${BASE}/status`, { params: new HttpParams().set('organizationId', organizationId) });
	}

	/** Starts the connect flow: the single-use state and where to send the person. */
	installState(organizationId: string): Observable<{ state: string; authorizeUrl: string }> {
		return this.http.post<{ state: string; authorizeUrl: string }>(`${BASE}/install/state`, { organizationId });
	}

	summary(integrationId: string): Observable<LinearConnectionSummary> {
		return this.http.get<LinearConnectionSummary>(this.connection(integrationId));
	}

	disconnect(integrationId: string): Observable<void> {
		return this.http.delete<void>(this.connection(integrationId));
	}

	teams(integrationId: string): Observable<LinearTeam[]> {
		return this.http.get<LinearTeam[]>(`${this.connection(integrationId)}/teams`);
	}

	team(integrationId: string, teamId: string): Observable<LinearTeamDetail> {
		return this.http.get<LinearTeamDetail>(`${this.connection(integrationId)}/teams/${encodeURIComponent(teamId)}`);
	}

	mappings(integrationId: string): Observable<LinearMapping[]> {
		return this.http.get<LinearMapping[]>(`${this.connection(integrationId)}/mappings`);
	}

	createMapping(integrationId: string, input: LinearMappingInput): Observable<LinearMapping> {
		return this.http.post<LinearMapping>(`${this.connection(integrationId)}/mappings`, input);
	}

	updateMapping(integrationId: string, mappingId: string, input: Partial<LinearMappingInput>): Observable<LinearMapping> {
		return this.http.put<LinearMapping>(`${this.connection(integrationId)}/mappings/${encodeURIComponent(mappingId)}`, input);
	}

	removeMapping(integrationId: string, mappingId: string): Observable<void> {
		return this.http.delete<void>(`${this.connection(integrationId)}/mappings/${encodeURIComponent(mappingId)}`);
	}

	/** Starts an import (every issue, or the changes since the last one); the run is answered at once. */
	importNow(integrationId: string, mappingId: string, full: boolean): Observable<{ accepted: true; run: LinearRun }> {
		return this.http.post<{ accepted: true; run: LinearRun }>(`${this.connection(integrationId)}/mappings/${encodeURIComponent(mappingId)}/import`, { full });
	}

	runs(integrationId: string, take = 50): Observable<LinearRun[]> {
		return this.http.get<LinearRun[]>(`${this.connection(integrationId)}/runs`, { params: new HttpParams().set('take', String(take)) });
	}
}
