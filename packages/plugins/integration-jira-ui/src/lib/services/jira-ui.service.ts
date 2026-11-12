import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';

const BASE = `${API_PREFIX}/integration/jira`;
/** The most task titles one read asks for (the task list's `filters[ids]` takes 25 ids). */
export const TASK_TITLES_MAX = 25;

export interface JiraConnectionSummary {
	id: string;
	organizationId: string;
	/** The Jira Cloud site the connection works with; null until one is chosen (the token reaches several). */
	cloudId: string | null;
	siteUrl: string | null;
	siteName: string | null;
	/** The Atlassian account the token is. */
	accountId: string | null;
	accountName: string | null;
	/** Whether a site must still be chosen before anything else works. */
	siteRequired: boolean;
	/** The connection's dynamic webhook: when it expires (the API refreshes it before), and why its last registration failed. */
	webhookExpiresAt: string | null;
	webhookError: string | null;
	connectedByUserId: string | null;
	attentionReason: string | null;
	tokenExpiresAt: string | null;
	lastSyncedAt: string | null;
	createdAt: string | null;
}

export interface JiraStatus {
	/** Whether the API holds the OAuth app (nobody can connect otherwise). */
	configured: boolean;
	/** Whether the API has a public address Jira can deliver webhooks to. */
	webhooks: boolean;
	/** The task status each status category becomes unless a mapping says otherwise. */
	defaultStatusMap: Record<string, string>;
	connection: JiraConnectionSummary | null;
}

/** A Jira Cloud site the connection's token reaches; one of them is the connection's (`selected`). */
export interface JiraSite {
	/** The cloud id. */
	id: string;
	url: string;
	name: string;
	avatarUrl?: string | null;
	selected: boolean;
}

export interface JiraProject {
	id: string;
	key: string;
	name: string;
	projectTypeKey?: string | null;
	style?: string | null;
}

export interface JiraIssueType {
	id: string;
	name: string;
	subtask: boolean;
	hierarchyLevel?: number | null;
}

export interface JiraStatusDefinition {
	id: string;
	name: string;
	statusCategory: { key: string; name?: string };
}

/** A Jira project with its issue types and the statuses its workflows use. */
export interface JiraProjectDetail {
	project: JiraProject;
	issueTypes: JiraIssueType[];
	statuses: JiraStatusDefinition[];
}

export type JiraDirection = 'inbound' | 'outbound' | 'both';

export interface JiraMapping {
	id: string;
	integrationId: string;
	jiraProjectId: string;
	jiraProjectKey: string | null;
	jiraProjectName: string | null;
	projectId: string;
	direction: JiraDirection;
	/**
	 * Status category (`new`, `indeterminate`, `done`) or `status:<id>` → task status name. The API answers the
	 * categories filled with its defaults; a `status:<id>` entry wins over its status's category.
	 */
	statusMap: Record<string, string>;
	/** The issue types imported (ids); empty for every type. */
	issueTypeIds: string[];
	syncEnabled: boolean;
	lastImportedAt: string | null;
	lastCursor: string | null;
	lastError: string | null;
}

export interface JiraMappingInput {
	jiraProjectId: string;
	jiraProjectKey?: string | null;
	jiraProjectName?: string | null;
	projectId: string;
	direction?: JiraDirection;
	statusMap?: Record<string, string>;
	issueTypeIds?: string[];
	syncEnabled?: boolean;
}

/** An issue a run could not apply, by its key, and why. */
export interface JiraRunFailure {
	key: string;
	error: string;
}

/** What a run reports beside its counts (written as it goes). */
export interface JiraRunReport {
	startedFrom: string | null;
	stoppedAt: string | null;
	/** Whether every page was read (a run stopped early continues from `stoppedAt` next time). */
	complete: boolean;
	pages: number;
	issuesRead: number;
	comments: number;
	links: number;
	relations: number;
	conflicts: number;
	failures: JiraRunFailure[];
	/** How many failed issues the report does not name. */
	moreFailures: number;
}

export interface JiraRun {
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
	report?: JiraRunReport | null;
	/** How many conflicts the run found (the runs list says it; a run just started has none yet). */
	conflictCount?: number;
}

/** What `POST …/:integrationId/webhook` did with the connection's webhook. */
export type JiraWebhookOutcome = 'off' | 'unchanged' | 'registered' | 'refreshed' | 'removed' | 'failed';

/** The task fields a conflict can name. */
export type JiraConflictField = 'title' | 'description' | 'status' | 'priority' | 'dueDate';
export type JiraConflictStatus = 'open' | 'resolved';
export type JiraConflictResolution = 'kept_external' | 'kept_platform' | 'superseded';
/** What a resolve keeps: Jira's value (already the task's), or the task's value written back. */
export type JiraConflictKeep = 'external' | 'platform';

/** A field changed both in Jira and on the platform to different values: Jira's was applied, the task's is kept here. */
export interface JiraConflict {
	id: string;
	tenantId: string;
	organizationId: string;
	integrationId: string;
	mappingId: string | null;
	runId: string | null;
	taskId: string;
	/** The Jira issue's id. */
	sourceId: string;
	field: JiraConflictField;
	syncedValue: string | null;
	/** The task's value, replaced by Jira's. */
	platformValue: string | null;
	/** Jira's value, applied to the task. */
	externalValue: string | null;
	status: JiraConflictStatus;
	resolution: JiraConflictResolution | null;
	resolvedAt: string | null;
	resolvedByUserId: string | null;
	createdAt: string | null;
}

/** Filters of the conflict list (open ones by default). */
export interface JiraConflictQuery {
	status?: JiraConflictStatus;
	runId?: string | null;
	mappingId?: string | null;
	taskId?: string | null;
	take?: number;
}

/** The HTTP client of the Jira integration's routes (`/api/integration/jira`). */
@Injectable({ providedIn: 'root' })
export class JiraUiService {
	private readonly http = inject(HttpClient);

	private connection(integrationId: string): string {
		return `${BASE}/${encodeURIComponent(integrationId)}`;
	}

	/** Whether the server is configured, and the organization's connection if any (404 when the plugin is not loaded). */
	status(organizationId: string): Observable<JiraStatus> {
		return this.http.get<JiraStatus>(`${BASE}/status`, { params: new HttpParams().set('organizationId', organizationId) });
	}

	/** Starts the connect flow: the single-use state and where to send the person. */
	installState(organizationId: string): Observable<{ state: string; authorizeUrl: string }> {
		return this.http.post<{ state: string; authorizeUrl: string }>(`${BASE}/install/state`, { organizationId });
	}

	summary(integrationId: string): Observable<JiraConnectionSummary> {
		return this.http.get<JiraConnectionSummary>(this.connection(integrationId));
	}

	disconnect(integrationId: string): Observable<void> {
		return this.http.delete<void>(this.connection(integrationId));
	}

	/** The Jira Cloud sites the connection's token reaches (one is the connection's). */
	sites(integrationId: string): Observable<JiraSite[]> {
		return this.http.get<JiraSite[]>(`${this.connection(integrationId)}/sites`);
	}

	/** Chooses the connection's site (409 `JIRA_SITE_HAS_MAPPINGS` while it has mappings on another site). */
	selectSite(integrationId: string, cloudId: string): Observable<JiraConnectionSummary> {
		return this.http.put<JiraConnectionSummary>(`${this.connection(integrationId)}/site`, { cloudId });
	}

	/** The Jira projects of the connection's site. */
	projects(integrationId: string): Observable<JiraProject[]> {
		return this.http.get<JiraProject[]>(`${this.connection(integrationId)}/projects`);
	}

	/** A Jira project with its issue types and statuses. */
	project(integrationId: string, projectId: string): Observable<JiraProjectDetail> {
		return this.http.get<JiraProjectDetail>(`${this.connection(integrationId)}/projects/${encodeURIComponent(projectId)}`);
	}

	mappings(integrationId: string): Observable<JiraMapping[]> {
		return this.http.get<JiraMapping[]>(`${this.connection(integrationId)}/mappings`);
	}

	createMapping(integrationId: string, input: JiraMappingInput): Observable<JiraMapping> {
		return this.http.post<JiraMapping>(`${this.connection(integrationId)}/mappings`, input);
	}

	updateMapping(integrationId: string, mappingId: string, input: Partial<JiraMappingInput>): Observable<JiraMapping> {
		return this.http.put<JiraMapping>(`${this.connection(integrationId)}/mappings/${encodeURIComponent(mappingId)}`, input);
	}

	removeMapping(integrationId: string, mappingId: string): Observable<void> {
		return this.http.delete<void>(`${this.connection(integrationId)}/mappings/${encodeURIComponent(mappingId)}`);
	}

	/** Starts an import (every issue, or the changes since the last one); the run is answered at once. */
	importNow(integrationId: string, mappingId: string, full: boolean): Observable<{ accepted: true; run: JiraRun }> {
		return this.http.post<{ accepted: true; run: JiraRun }>(`${this.connection(integrationId)}/mappings/${encodeURIComponent(mappingId)}/import`, { full });
	}

	/** Brings the connection's webhook in line with its mappings now (after a failed registration). */
	registerWebhook(integrationId: string): Observable<{ outcome: JiraWebhookOutcome; connection: JiraConnectionSummary }> {
		return this.http.post<{ outcome: JiraWebhookOutcome; connection: JiraConnectionSummary }>(`${this.connection(integrationId)}/webhook`, {});
	}

	/** The latest runs, each with its report and how many conflicts it found. */
	runs(integrationId: string, take = 50): Observable<JiraRun[]> {
		return this.http.get<JiraRun[]>(`${this.connection(integrationId)}/runs`, { params: new HttpParams().set('take', String(take)) });
	}

	/** The connection's conflicts, newest first: open ones unless the query says otherwise. */
	conflicts(integrationId: string, query: JiraConflictQuery = {}): Observable<JiraConflict[]> {
		let params = new HttpParams();
		if (query.status) params = params.set('status', query.status);
		if (query.runId) params = params.set('runId', query.runId);
		if (query.mappingId) params = params.set('mappingId', query.mappingId);
		if (query.taskId) params = params.set('taskId', query.taskId);
		if (query.take) params = params.set('take', String(query.take));
		return this.http.get<JiraConflict[]>(`${this.connection(integrationId)}/conflicts`, { params });
	}

	/** Resolves an open conflict (409 when the task changed since, 404 when it is resolved already). */
	resolveConflict(integrationId: string, conflictId: string, keep: JiraConflictKeep): Observable<JiraConflict> {
		return this.http.post<JiraConflict>(`${this.connection(integrationId)}/conflicts/${encodeURIComponent(conflictId)}/resolve`, { keep });
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
