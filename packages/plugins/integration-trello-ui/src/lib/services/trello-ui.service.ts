import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';

const BASE = `${API_PREFIX}/integration/trello`;
/** The most task titles one read asks for (the task list's `filters[ids]` takes 25 ids). */
export const TASK_TITLES_MAX = 25;

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
	/** How many conflicts the run found (the runs list says it; a run just started has none yet). */
	conflictCount?: number;
}

/** The task fields a conflict can name. */
export type TrelloConflictField = 'title' | 'description' | 'status' | 'priority' | 'dueDate';
export type TrelloConflictStatus = 'open' | 'resolved';
export type TrelloConflictResolution = 'kept_external' | 'kept_platform' | 'superseded';
/** What a resolve keeps: Trello's value (already the task's), or the task's value written back. */
export type TrelloConflictKeep = 'external' | 'platform';

/** A field changed both in Trello and on the platform to different values: Trello's was applied, the task's is kept here. */
export interface TrelloConflict {
	id: string;
	tenantId: string;
	organizationId: string;
	integrationId: string;
	mappingId: string | null;
	runId: string | null;
	taskId: string;
	/** The Trello card's id. */
	sourceId: string;
	field: TrelloConflictField;
	syncedValue: string | null;
	/** The task's value, replaced by Trello's. */
	platformValue: string | null;
	/** Trello's value, applied to the task. */
	externalValue: string | null;
	status: TrelloConflictStatus;
	resolution: TrelloConflictResolution | null;
	resolvedAt: string | null;
	resolvedByUserId: string | null;
	createdAt: string | null;
}

/** Filters of the conflict list (open ones by default). */
export interface TrelloConflictQuery {
	status?: TrelloConflictStatus;
	runId?: string | null;
	mappingId?: string | null;
	taskId?: string | null;
	take?: number;
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

	/** The latest runs, each with how many conflicts it found. */
	runs(integrationId: string, take = 50): Observable<TrelloRun[]> {
		return this.http.get<TrelloRun[]>(`${this.connection(integrationId)}/runs`, { params: new HttpParams().set('take', String(take)) });
	}

	/** The connection's conflicts, newest first: open ones unless the query says otherwise. */
	conflicts(integrationId: string, query: TrelloConflictQuery = {}): Observable<TrelloConflict[]> {
		let params = new HttpParams();
		if (query.status) params = params.set('status', query.status);
		if (query.runId) params = params.set('runId', query.runId);
		if (query.mappingId) params = params.set('mappingId', query.mappingId);
		if (query.taskId) params = params.set('taskId', query.taskId);
		if (query.take) params = params.set('take', String(query.take));
		return this.http.get<TrelloConflict[]>(`${this.connection(integrationId)}/conflicts`, { params });
	}

	/** Resolves an open conflict (409 when the task changed since, 404 when it is resolved already). */
	resolveConflict(integrationId: string, conflictId: string, keep: TrelloConflictKeep): Observable<TrelloConflict> {
		return this.http.post<TrelloConflict>(`${this.connection(integrationId)}/conflicts/${encodeURIComponent(conflictId)}/resolve`, { keep });
	}

	/**
	 * The titles of the tasks conflicts name, by id, in one read of the organization's tasks (`GET /tasks` with the
	 * `ids` filter: unlike `GET /tasks/:id`, it records no visit). A task that cannot be read (deleted, not visible to
	 * the caller) is left out; a failed read answers null (the titles are asked again on a later read).
	 */
	taskTitles(scope: { tenantId: string; organizationId: string }, taskIds: readonly string[]): Observable<Record<string, string> | null> {
		const ids = [...new Set(taskIds.filter(Boolean))].slice(0, TASK_TITLES_MAX);
		if (!ids.length) return of({});
		let params = new HttpParams()
			.set('where[tenantId]', scope.tenantId)
			.set('where[organizationId]', scope.organizationId)
			.set('select[id]', 'true')
			.set('select[title]', 'true')
			.set('take', String(ids.length));
		ids.forEach((id, index) => (params = params.set(`filters[ids][${index}]`, id)));
		return this.http.get<{ items?: Array<{ id?: string; title?: string | null }> }>(`${API_PREFIX}/tasks`, { params }).pipe(
			map((page) => {
				const titles: Record<string, string> = {};
				for (const task of page?.items ?? []) {
					const title = typeof task?.title === 'string' ? task.title.trim() : '';
					if (task?.id && title) titles[task.id] = title;
				}
				return titles;
			}),
			catchError(() => of(null))
		);
	}
}
