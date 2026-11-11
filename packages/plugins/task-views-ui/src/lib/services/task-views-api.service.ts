import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import {
	ID,
	IPagination,
	ITask,
	ITaskBulkUpdateInput,
	ITaskBulkUpdateOutcome,
	ITaskReferenceResolution,
	ITaskView,
	ITaskViewCreateInput,
	ITaskViewFilterGroup,
	ITaskViewOrderInput,
	ITaskViewTasksPage,
	ITaskViewUpdateInput,
	TaskBuiltInViewEnum,
	TaskViewGroupBy
} from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { SAVED_VIEWS_PAGE_SIZE, TASK_VIEWS_PAGE_SIZE, TASK_VIEWS_RELATIONS } from '../task-views-ui.constants';

const VIEWS = `${API_PREFIX}/task-views`;
const TASKS = `${API_PREFIX}/tasks`;
const path = (id: ID | string) => encodeURIComponent(String(id));

/** The organization (and tenant) every call names, so a stale page never reads another organization. */
export interface TaskViewsScope {
	organizationId: ID;
	tenantId?: ID;
}

/** A page of a view's tasks to ask for: the cursor, the grouping and the edited filter. */
export interface TaskViewTasksRequest {
	cursor?: string | null;
	limit?: number;
	groupBy?: TaskViewGroupBy;
	/** An edited tree instead of the view's own; an empty group asks for no filter. */
	filter?: ITaskViewFilterGroup | null;
	timeZone?: string;
}

/** The IANA time zone relative dates and the built-in views are read in: the browser's, else UTC. */
export function browserTimeZone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
	} catch {
		return 'UTC';
	}
}

/** Query parameters with nested `where[...]` keys, as the platform's list routes read them. */
export function whereParams(scope: TaskViewsScope, extra: Record<string, string | number> = {}): HttpParams {
	let params = new HttpParams().set('where[organizationId]', String(scope.organizationId));
	if (scope.tenantId) params = params.set('where[tenantId]', String(scope.tenantId));
	for (const [key, value] of Object.entries(extra)) params = params.set(key, String(value));
	return params;
}

/** Flat query parameters (`organizationId`, `tenantId`, …), as the extension routes read them. */
export function scopeParams(scope: TaskViewsScope): HttpParams {
	let params = new HttpParams().set('organizationId', String(scope.organizationId));
	if (scope.tenantId) params = params.set('tenantId', String(scope.tenantId));
	return params;
}

/**
 * The platform's task views routes: the saved views (`/task-views`), a view's tasks, its manual order, the built-in
 * views, the bulk update, the reference resolver and the task delete. `changed$` tells the pages something was
 * written, so a list shown elsewhere reads again.
 */
@Injectable({ providedIn: 'root' })
export class TaskViewsApiService {
	private readonly http = inject(HttpClient);
	private readonly changes = new Subject<'views' | 'tasks'>();

	/** Emits after a write: `views` when a saved view changed, `tasks` when tasks did. */
	readonly changed$: Observable<'views' | 'tasks'> = this.changes.asObservable();

	notify(kind: 'views' | 'tasks'): void {
		this.changes.next(kind);
	}

	// ---------------------------------------------------------------- saved views

	/** One page of the saved views the caller may see in the organization (shared ones, and their own personal ones). */
	listViews(scope: TaskViewsScope, skip = 0, take = SAVED_VIEWS_PAGE_SIZE): Observable<IPagination<ITaskView>> {
		return this.http.get<IPagination<ITaskView>>(VIEWS, { params: whereParams(scope, { skip, take }) });
	}

	getView(id: ID, scope: TaskViewsScope): Observable<ITaskView> {
		return this.http.get<ITaskView>(`${VIEWS}/${path(id)}`, { params: whereParams(scope) });
	}

	createView(input: ITaskViewCreateInput): Observable<ITaskView> {
		return this.http.post<ITaskView>(VIEWS, input);
	}

	/** Saves a view; a stated `expectedVersion` is refused with 409 (and the latest view) when it is stale. */
	updateView(id: ID, input: ITaskViewUpdateInput): Observable<ITaskView> {
		return this.http.put<ITaskView>(`${VIEWS}/${path(id)}`, input);
	}

	deleteView(id: ID): Observable<unknown> {
		return this.http.delete(`${VIEWS}/${path(id)}`);
	}

	/** Sets the manual order (every task once), checked against the version read. */
	setOrder(id: ID, input: ITaskViewOrderInput): Observable<ITaskView> {
		return this.http.put<ITaskView>(`${VIEWS}/${path(id)}/order`, input);
	}

	/** A page of a view's tasks: cursor paging, the counts per group and the filters that could not be applied. */
	viewTasks(id: ID, scope: TaskViewsScope, request: TaskViewTasksRequest = {}): Observable<ITaskViewTasksPage> {
		let params = scopeParams(scope)
			.set('limit', String(request.limit ?? TASK_VIEWS_PAGE_SIZE))
			.set('timeZone', request.timeZone ?? browserTimeZone())
			.set('relations', TASK_VIEWS_RELATIONS.join(','));
		if (request.cursor) params = params.set('cursor', request.cursor);
		if (request.groupBy) params = params.set('groupBy', request.groupBy);
		if (request.filter !== undefined)
			params = params.set('filter', JSON.stringify(request.filter ?? { op: 'and', conditions: [] }));
		return this.http.get<ITaskViewTasksPage>(`${VIEWS}/${path(id)}/tasks`, { params });
	}

	// ---------------------------------------------------------------- built-in views

	/** A page of a built-in view, computed by the platform in the caller's time zone (offset paging). */
	builtIn(
		key: TaskBuiltInViewEnum,
		scope: TaskViewsScope,
		skip = 0,
		take = TASK_VIEWS_PAGE_SIZE,
		timeZone = browserTimeZone()
	): Observable<IPagination<ITask>> {
		let params = scopeParams(scope).set('skip', String(skip)).set('take', String(take)).set('timeZone', timeZone);
		for (const relation of TASK_VIEWS_RELATIONS) params = params.append('relations[]', relation);
		return this.http.get<IPagination<ITask>>(`${TASKS}/built-in/${path(key)}`, { params });
	}

	// ---------------------------------------------------------------- tasks

	/** One request changing up to 100 tasks; the answer carries each task's previous values (the undo). */
	bulkUpdate(input: ITaskBulkUpdateInput): Observable<ITaskBulkUpdateOutcome> {
		return this.http.post<ITaskBulkUpdateOutcome>(`${TASKS}/bulk-update`, input);
	}

	/** `KEY-number` references to the tasks they name, one resolution per reference. */
	resolveReferences(references: string[], scope: TaskViewsScope): Observable<ITaskReferenceResolution[]> {
		return this.http.post<ITaskReferenceResolution[]>(`${TASKS}/resolve-references`, { ...scope, references });
	}

	/** One task, by the platform's own delete. */
	deleteTask(id: ID): Observable<unknown> {
		return this.http.delete(`${TASKS}/${path(id)}`);
	}

	/** One task with the relations a row shows (the reference chip, a row read again after a change). */
	getTask(id: ID, scope: TaskViewsScope): Observable<ITask> {
		let params = scopeParams(scope);
		for (const relation of ['project']) params = params.append('relations[]', relation);
		return this.http.get<ITask>(`${TASKS}/${path(id)}`, { params }).pipe(map((task) => task));
	}
}
