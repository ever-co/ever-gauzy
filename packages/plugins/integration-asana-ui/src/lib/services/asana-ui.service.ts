import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';

const BASE = `${API_PREFIX}/integration/asana`;

export interface AsanaConnectionSummary {
	id: string;
	organizationId: string;
	asanaUserGid: string | null;
	asanaUserName: string | null;
	asanaUserEmail: string | null;
	connectedByUserId: string | null;
	attentionReason: string | null;
	tokenExpiresAt: string | null;
	lastSyncedAt: string | null;
	createdAt: string | null;
}

export interface AsanaStatus {
	configured: boolean;
	/** Whether the server has a public address Asana can deliver webhooks to. */
	webhooks: boolean;
	connection: AsanaConnectionSummary | null;
}

export interface AsanaWorkspace {
	gid: string;
	name: string;
}

export interface AsanaMetadata {
	user: { gid: string; name: string; email: string | null };
	workspaces: AsanaWorkspace[];
}

export interface AsanaProject {
	gid: string;
	name: string;
	archived: boolean;
}

export interface AsanaSection {
	gid: string;
	name: string;
}

export type AsanaDirection = 'inbound' | 'outbound' | 'both';

export interface AsanaMapping {
	id: string;
	integrationId: string;
	asanaWorkspaceGid: string;
	asanaProjectGid: string;
	asanaProjectName: string | null;
	projectId: string;
	direction: AsanaDirection;
	/** Section gid → task status name. */
	sectionMap: Record<string, string>;
	syncEnabled: boolean;
	hasWebhook: boolean;
	lastImportedAt: string | null;
	lastCursor: string | null;
	lastError: string | null;
}

export interface AsanaMappingInput {
	asanaWorkspaceGid: string;
	asanaProjectGid: string;
	asanaProjectName?: string | null;
	projectId: string;
	direction?: AsanaDirection;
	sectionMap?: Record<string, string> | null;
	syncEnabled?: boolean;
}

export interface AsanaRun {
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

/** The HTTP client of the Asana integration's routes (`/api/integration/asana`). */
@Injectable({ providedIn: 'root' })
export class AsanaUiService {
	private readonly http = inject(HttpClient);

	private connection(integrationId: string): string {
		return `${BASE}/${encodeURIComponent(integrationId)}`;
	}

	/** Whether the server is configured, and the organization's connection if any (404 when the plugin is not loaded). */
	status(organizationId: string): Observable<AsanaStatus> {
		return this.http.get<AsanaStatus>(`${BASE}/status`, { params: new HttpParams().set('organizationId', organizationId) });
	}

	/** Starts the connect flow: the single-use state and where to send the person. */
	installState(organizationId: string): Observable<{ state: string; authorizeUrl: string }> {
		return this.http.post<{ state: string; authorizeUrl: string }>(`${BASE}/install/state`, { organizationId });
	}

	summary(integrationId: string): Observable<AsanaConnectionSummary> {
		return this.http.get<AsanaConnectionSummary>(this.connection(integrationId));
	}

	disconnect(integrationId: string): Observable<void> {
		return this.http.delete<void>(this.connection(integrationId));
	}

	/** Who the connection is, and the workspaces it opens. */
	metadata(integrationId: string): Observable<AsanaMetadata> {
		return this.http.get<AsanaMetadata>(`${this.connection(integrationId)}/metadata`);
	}

	/** The (unarchived) projects of a workspace. */
	projects(integrationId: string, workspaceGid: string): Observable<AsanaProject[]> {
		return this.http.get<AsanaProject[]>(`${this.connection(integrationId)}/workspaces/${encodeURIComponent(workspaceGid)}/projects`);
	}

	sections(integrationId: string, projectGid: string): Observable<AsanaSection[]> {
		return this.http.get<AsanaSection[]>(`${this.connection(integrationId)}/projects/${encodeURIComponent(projectGid)}/sections`);
	}

	mappings(integrationId: string): Observable<AsanaMapping[]> {
		return this.http.get<AsanaMapping[]>(`${this.connection(integrationId)}/mappings`);
	}

	createMapping(integrationId: string, input: AsanaMappingInput): Observable<AsanaMapping> {
		return this.http.post<AsanaMapping>(`${this.connection(integrationId)}/mappings`, input);
	}

	updateMapping(integrationId: string, mappingId: string, input: Partial<AsanaMappingInput>): Observable<AsanaMapping> {
		return this.http.put<AsanaMapping>(`${this.connection(integrationId)}/mappings/${encodeURIComponent(mappingId)}`, input);
	}

	removeMapping(integrationId: string, mappingId: string): Observable<void> {
		return this.http.delete<void>(`${this.connection(integrationId)}/mappings/${encodeURIComponent(mappingId)}`);
	}

	/** Registers the mapping's webhook on Asana again (behind the response). */
	registerWebhook(integrationId: string, mappingId: string): Observable<{ accepted: true }> {
		return this.http.post<{ accepted: true }>(`${this.connection(integrationId)}/mappings/${encodeURIComponent(mappingId)}/webhook`, {});
	}

	/** Starts an import (every task, or the changes since the last one); the run is answered at once. */
	importNow(integrationId: string, mappingId: string, full: boolean): Observable<{ accepted: true; run: AsanaRun }> {
		return this.http.post<{ accepted: true; run: AsanaRun }>(`${this.connection(integrationId)}/mappings/${encodeURIComponent(mappingId)}/import`, { full });
	}

	runs(integrationId: string, take = 50): Observable<AsanaRun[]> {
		return this.http.get<AsanaRun[]>(`${this.connection(integrationId)}/runs`, { params: new HttpParams().set('take', String(take)) });
	}
}
