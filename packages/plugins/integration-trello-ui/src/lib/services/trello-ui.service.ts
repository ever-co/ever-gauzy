import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';

const BASE = `${API_PREFIX}/integration/trello`;

export interface TrelloConnectionSummary {
	id: string;
	organizationId: string;
	trelloMemberId: string | null;
	trelloMemberUsername: string | null;
	trelloMemberName: string | null;
	connectedByUserId: string | null;
	attentionReason: string | null;
	lastSyncedAt: string | null;
	createdAt: string | null;
}

export interface TrelloStatus {
	configured: boolean;
	/** Whether the server has a public address and the application's secret, so Trello's webhooks can be taken. */
	webhooks: boolean;
	connection: TrelloConnectionSummary | null;
}

export interface TrelloBoard {
	id: string;
	name: string;
	closed: boolean;
	idOrganization: string | null;
	url: string | null;
}

export interface TrelloMetadata {
	member: { id: string; username: string; fullName: string };
	boards: TrelloBoard[];
}

export interface TrelloList {
	id: string;
	name: string;
	closed: boolean;
	pos: number;
}

export type TrelloDirection = 'inbound' | 'outbound' | 'both';

export interface TrelloMapping {
	id: string;
	integrationId: string;
	trelloBoardId: string;
	trelloBoardName: string | null;
	projectId: string;
	direction: TrelloDirection;
	/** List id → task status name. */
	listMap: Record<string, string>;
	syncEnabled: boolean;
	hasWebhook: boolean;
	lastImportedAt: string | null;
	lastCursor: string | null;
	lastError: string | null;
}

export interface TrelloMappingInput {
	trelloBoardId: string;
	trelloBoardName?: string | null;
	projectId: string;
	direction?: TrelloDirection;
	listMap?: Record<string, string> | null;
	syncEnabled?: boolean;
}

export interface TrelloRun {
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

/** The HTTP client of the Trello integration's routes (`/api/integration/trello`). */
@Injectable({ providedIn: 'root' })
export class TrelloUiService {
	private readonly http = inject(HttpClient);

	private connection(integrationId: string): string {
		return `${BASE}/${encodeURIComponent(integrationId)}`;
	}

	/** Whether the server is configured, and the organization's connection if any (404 when the plugin is not loaded). */
	status(organizationId: string): Observable<TrelloStatus> {
		return this.http.get<TrelloStatus>(`${BASE}/status`, { params: new HttpParams().set('organizationId', organizationId) });
	}

	/** Starts the connect flow: the single-use state and Trello's authorize page to send the person to. */
	installState(organizationId: string): Observable<{ state: string; authorizeUrl: string }> {
		return this.http.post<{ state: string; authorizeUrl: string }>(`${BASE}/install/state`, { organizationId });
	}

	/** Finishes the connect flow with the token Trello returned and the state the flow started with. */
	connect(organizationId: string, token: string, state: string): Observable<TrelloConnectionSummary> {
		return this.http.post<TrelloConnectionSummary>(`${BASE}/connect`, { organizationId, token, state });
	}

	summary(integrationId: string): Observable<TrelloConnectionSummary> {
		return this.http.get<TrelloConnectionSummary>(this.connection(integrationId));
	}

	disconnect(integrationId: string): Observable<void> {
		return this.http.delete<void>(this.connection(integrationId));
	}

	/** Who the connection is, and the open boards it may see. */
	metadata(integrationId: string): Observable<TrelloMetadata> {
		return this.http.get<TrelloMetadata>(`${this.connection(integrationId)}/metadata`);
	}

	lists(integrationId: string, boardId: string): Observable<TrelloList[]> {
		return this.http.get<TrelloList[]>(`${this.connection(integrationId)}/boards/${encodeURIComponent(boardId)}/lists`);
	}

	mappings(integrationId: string): Observable<TrelloMapping[]> {
		return this.http.get<TrelloMapping[]>(`${this.connection(integrationId)}/mappings`);
	}

	createMapping(integrationId: string, input: TrelloMappingInput): Observable<TrelloMapping> {
		return this.http.post<TrelloMapping>(`${this.connection(integrationId)}/mappings`, input);
	}

	updateMapping(integrationId: string, mappingId: string, input: Partial<TrelloMappingInput>): Observable<TrelloMapping> {
		return this.http.put<TrelloMapping>(`${this.connection(integrationId)}/mappings/${encodeURIComponent(mappingId)}`, input);
	}

	removeMapping(integrationId: string, mappingId: string): Observable<void> {
		return this.http.delete<void>(`${this.connection(integrationId)}/mappings/${encodeURIComponent(mappingId)}`);
	}

	/** Registers the mapping's webhook on Trello again (behind the response). */
	registerWebhook(integrationId: string, mappingId: string): Observable<{ accepted: true }> {
		return this.http.post<{ accepted: true }>(`${this.connection(integrationId)}/mappings/${encodeURIComponent(mappingId)}/webhook`, {});
	}

	/** Starts an import (every card, or the changes since the last one); the run is answered at once. */
	importNow(integrationId: string, mappingId: string, full: boolean): Observable<{ accepted: true; run: TrelloRun }> {
		return this.http.post<{ accepted: true; run: TrelloRun }>(`${this.connection(integrationId)}/mappings/${encodeURIComponent(mappingId)}/import`, { full });
	}

	runs(integrationId: string, take = 50): Observable<TrelloRun[]> {
		return this.http.get<TrelloRun[]>(`${this.connection(integrationId)}/runs`, { params: new HttpParams().set('take', String(take)) });
	}
}
