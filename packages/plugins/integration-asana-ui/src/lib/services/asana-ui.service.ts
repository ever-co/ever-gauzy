import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';

const BASE = `${API_PREFIX}/integration/asana`;
/** The most task titles one read asks for (the task list's `filters[ids]` takes 25 ids). */
export const TASK_TITLES_MAX = 25;

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
	/** How many conflicts the run found (the runs list says it; a run just started has none yet). */
	conflictCount?: number;
}

/** The task fields a conflict can name. */
export type AsanaConflictField = 'title' | 'description' | 'status' | 'priority' | 'dueDate';
export type AsanaConflictStatus = 'open' | 'resolved';
export type AsanaConflictResolution = 'kept_external' | 'kept_platform' | 'superseded';
/** What a resolve keeps: Asana's value (already the task's), or the task's value written back. */
export type AsanaConflictKeep = 'external' | 'platform';

/** A field changed both in Asana and on the platform to different values: Asana's was applied, the task's is kept here. */
export interface AsanaConflict {
	id: string;
	tenantId: string;
	organizationId: string;
	integrationId: string;
	mappingId: string | null;
	runId: string | null;
	taskId: string;
	/** The Asana task's id. */
	sourceId: string;
	field: AsanaConflictField;
	syncedValue: string | null;
	/** The task's value, replaced by Asana's. */
	platformValue: string | null;
	/** Asana's value, applied to the task. */
	externalValue: string | null;
	status: AsanaConflictStatus;
	resolution: AsanaConflictResolution | null;
	resolvedAt: string | null;
	resolvedByUserId: string | null;
	createdAt: string | null;
}

/** Filters of the conflict list (open ones by default). */
export interface AsanaConflictQuery {
	status?: AsanaConflictStatus;
	runId?: string | null;
	mappingId?: string | null;
	taskId?: string | null;
	take?: number;
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

	/** The latest runs, each with how many conflicts it found. */
	runs(integrationId: string, take = 50): Observable<AsanaRun[]> {
		return this.http.get<AsanaRun[]>(`${this.connection(integrationId)}/runs`, { params: new HttpParams().set('take', String(take)) });
	}

	/** The connection's conflicts, newest first: open ones unless the query says otherwise. */
	conflicts(integrationId: string, query: AsanaConflictQuery = {}): Observable<AsanaConflict[]> {
		let params = new HttpParams();
		if (query.status) params = params.set('status', query.status);
		if (query.runId) params = params.set('runId', query.runId);
		if (query.mappingId) params = params.set('mappingId', query.mappingId);
		if (query.taskId) params = params.set('taskId', query.taskId);
		if (query.take) params = params.set('take', String(query.take));
		return this.http.get<AsanaConflict[]>(`${this.connection(integrationId)}/conflicts`, { params });
	}

	/** Resolves an open conflict (409 when the task changed since, 404 when it is resolved already). */
	resolveConflict(integrationId: string, conflictId: string, keep: AsanaConflictKeep): Observable<AsanaConflict> {
		return this.http.post<AsanaConflict>(`${this.connection(integrationId)}/conflicts/${encodeURIComponent(conflictId)}/resolve`, { keep });
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
