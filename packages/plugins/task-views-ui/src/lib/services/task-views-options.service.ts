import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { ID, IPagination, TaskViewFilterField } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { TaskViewsScope, scopeParams, whereParams } from './task-views-api.service';

/** One record a filter or the bulk toolbar can pick: its id, its name, and how it is drawn. */
export interface TaskViewOption {
	id: ID;
	label: string;
	/** The platform's name of a status, priority or size (`in-progress`): what a bulk change sends beside the id. */
	value?: string;
	color?: string | null;
	imageUrl?: string | null;
}

/** The records of an organization the editor and the toolbar pick from, by the field that names them. */
export type TaskViewOptions = Record<
	'status' | 'priority' | 'size' | 'labels' | 'assignees' | 'project' | 'team' | 'sprint',
	TaskViewOption[]
>;

export const EMPTY_OPTIONS: TaskViewOptions = {
	status: [],
	priority: [],
	size: [],
	labels: [],
	assignees: [],
	project: [],
	team: [],
	sprint: []
};

/** The option list a filter field picks from (dates pick none). */
export function optionsOfField(options: TaskViewOptions, field: TaskViewFilterField): TaskViewOption[] {
	return (options as Record<string, TaskViewOption[]>)[field] ?? [];
}

/** A status, priority or size name for people (`in-progress` → `in progress`). */
export function humanize(name: string | null | undefined): string {
	return String(name ?? '')
		.replace(/[-_]+/g, ' ')
		.trim();
}

type Named = {
	id?: ID;
	name?: string | null;
	value?: string | null;
	color?: string | null;
	imageUrl?: string | null;
	fullName?: string | null;
	user?: {
		name?: string | null;
		firstName?: string | null;
		lastName?: string | null;
		email?: string | null;
		imageUrl?: string | null;
	} | null;
};

function itemsOf<T>(answer: IPagination<T> | T[] | null | undefined): T[] {
	if (Array.isArray(answer)) return answer;
	return answer?.items ?? [];
}

function byLabel(a: TaskViewOption, b: TaskViewOption): number {
	return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
}

/** A person's name as the lists show it. */
export function personName(record: Named): string {
	const user = record.user;
	const name =
		record.fullName ||
		user?.name ||
		[user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
		user?.email ||
		'';
	return String(name).trim();
}

/**
 * The organization's statuses, priorities, sizes, labels, people, projects, teams and sprints, read once per
 * organization: what the filter editor offers, what the group headers are named by, and what the bulk toolbar sets.
 * A list that cannot be read is empty (the editor shows the ids it cannot name as unknown) rather than failing the page.
 */
@Injectable({ providedIn: 'root' })
export class TaskViewsOptionsService {
	private readonly http = inject(HttpClient);
	private readonly cache = new Map<string, Observable<TaskViewOptions>>();

	/**
	 * The records of the scope, read once per signed-in user and organization (another user never gets the lists
	 * read for the previous one). A list that could not be read is empty this time and read again next time.
	 */
	options(scope: TaskViewsScope & { userId?: string }): Observable<TaskViewOptions> {
		const key = `${scope.userId ?? ''}:${scope.tenantId ?? ''}:${scope.organizationId}`;
		let cached = this.cache.get(key);
		if (!cached) {
			const failed = { any: false };
			cached = this.load(scope, failed).pipe(
				tap(() => {
					if (failed.any) this.cache.delete(key);
				}),
				shareReplay({ bufferSize: 1, refCount: false })
			);
			this.cache.set(key, cached);
		}
		return cached;
	}

	/** Forgets what was read (after a label or a status was added elsewhere). */
	forget(): void {
		this.cache.clear();
	}

	private load(scope: TaskViewsScope, failed: { any: boolean }): Observable<TaskViewOptions> {
		const get = <T>(url: string, params: HttpParams) =>
			this.http.get<IPagination<T> | T[]>(url, { params }).pipe(
				map((answer) => itemsOf<T>(answer)),
				catchError(() => {
					failed.any = true;
					return of([] as T[]);
				})
			);
		const organization: TaskViewsScope = {
			organizationId: scope.organizationId,
			...(scope.tenantId ? { tenantId: scope.tenantId } : {})
		};
		const flat = scopeParams(organization);
		const nested = whereParams(organization);
		const named = (records: Named[], withValue = false) =>
			records
				.filter((record) => !!record.id)
				.map((record) => ({
					id: record.id as ID,
					label: humanize(record.name) || String(record.value ?? ''),
					...(withValue ? { value: String(record.value ?? record.name ?? '') } : {}),
					color: record.color ?? null
				}))
				.sort(byLabel);
		return forkJoin({
			status: get<Named>(`${API_PREFIX}/task-statuses`, flat),
			priority: get<Named>(`${API_PREFIX}/task-priorities`, flat),
			size: get<Named>(`${API_PREFIX}/task-sizes`, flat),
			labels: get<Named>(`${API_PREFIX}/tags/level`, flat),
			assignees: get<Named>(`${API_PREFIX}/employee`, nested.append('relations[]', 'user')),
			project: get<Named>(`${API_PREFIX}/organization-projects`, nested),
			team: get<Named>(`${API_PREFIX}/organization-team`, nested),
			sprint: get<Named>(
				`${API_PREFIX}/organization-sprint`,
				new HttpParams().set('data', JSON.stringify({ findInput: organization }))
			)
		}).pipe(
			map((lists) => ({
				status: named(lists.status, true),
				priority: named(lists.priority, true),
				size: named(lists.size, true),
				labels: named(lists.labels),
				assignees: lists.assignees
					.filter((record) => !!record.id)
					.map((record) => ({
						id: record.id as ID,
						label: personName(record) || String(record.id),
						imageUrl: record.user?.imageUrl ?? null
					}))
					.sort(byLabel),
				project: lists.project
					.filter((record) => !!record.id)
					.map((record) => ({
						id: record.id as ID,
						label: String(record.name ?? ''),
						imageUrl: record.imageUrl ?? null
					}))
					.sort(byLabel),
				team: lists.team
					.filter((record) => !!record.id)
					.map((record) => ({ id: record.id as ID, label: String(record.name ?? '') }))
					.sort(byLabel),
				sprint: lists.sprint
					.filter((record) => !!record.id)
					.map((record) => ({ id: record.id as ID, label: String(record.name ?? '') }))
					.sort(byLabel)
			}))
		);
	}
}
