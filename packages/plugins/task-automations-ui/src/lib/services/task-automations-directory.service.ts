import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
	ID,
	IEmployee,
	IOrganizationProject,
	IOrganizationTeam,
	IPagination,
	ITag,
	ITask,
	ITaskPriority,
	ITaskStatus,
	TaskPriorityEnum,
	TaskStatusEnum
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { TASK_AUTOMATIONS_TEST_TASKS } from '../task-automations-ui.constants';

/** One choice of a picker: the value a rule stores and what the page shows. */
export interface ITaskAutomationChoice {
	value: string;
	label: string;
	/** Something to tell two choices of the same name apart (a project, an email, a reference). */
	detail?: string | null;
	/** `label` is a translation key of the plugin's namespace. */
	translate?: boolean;
}

/** What the editor offers to choose from, for one organization. */
export interface ITaskAutomationDirectory {
	statuses: ITaskAutomationChoice[];
	priorities: ITaskAutomationChoice[];
	tags: ITaskAutomationChoice[];
	employees: ITaskAutomationChoice[];
	projects: ITaskAutomationChoice[];
	teams: ITaskAutomationChoice[];
}

const byLabel = (a: ITaskAutomationChoice, b: ITaskAutomationChoice) => a.label.localeCompare(b.label);

/** The project or team a rule is narrowed to (its own statuses and priorities). */
export interface ITaskAutomationScope {
	projectId?: ID | null;
	organizationTeamId?: ID | null;
}

function scopeParams(scope: ITaskAutomationScope): Record<string, string> {
	return {
		...(scope.projectId ? { projectId: String(scope.projectId) } : {}),
		...(scope.organizationTeamId ? { organizationTeamId: String(scope.organizationTeamId) } : {})
	};
}

/** Two choice lists as one: the first's choices, then the second's it does not hold (by value). */
export function mergeChoices(first: readonly ITaskAutomationChoice[], second: readonly ITaskAutomationChoice[]): ITaskAutomationChoice[] {
	const known = new Set(first.map((choice) => choice.value));
	return [...first, ...second.filter((choice) => !known.has(choice.value))];
}

/** The platform's default statuses (`TaskStatusEnum`), every organization's whether or not it keeps rows. */
export const DEFAULT_STATUS_CHOICES: ITaskAutomationChoice[] = Object.values(TaskStatusEnum)
	.filter((value) => value !== TaskStatusEnum.CUSTOM)
	.map((value) => ({ value, label: value }));

/** The platform's default priorities (`TaskPriorityEnum`). */
export const DEFAULT_PRIORITY_CHOICES: ITaskAutomationChoice[] = Object.values(TaskPriorityEnum).map((value) => ({ value, label: value }));

/**
 * The statuses a rule may name: the organization's (by value, so one rule covers the same status of every project),
 * then the defaults it has no row for. A status the organization renamed keeps its value as the stored choice.
 */
export function statusChoices(rows: Array<Pick<ITaskStatus, 'value' | 'name'>>): ITaskAutomationChoice[] {
	const byValue = new Map<string, ITaskAutomationChoice>();
	for (const row of rows) {
		const value = String(row?.value ?? '').trim();
		if (!value || byValue.has(value)) continue;
		byValue.set(value, { value, label: (row.name ?? '').trim() || value });
	}
	for (const choice of DEFAULT_STATUS_CHOICES) {
		if (!byValue.has(choice.value)) byValue.set(choice.value, choice);
	}
	return [...byValue.values()];
}

/** The priorities a rule may name, as the statuses. */
export function priorityChoices(rows: Array<Pick<ITaskPriority, 'value' | 'name'>>): ITaskAutomationChoice[] {
	const byValue = new Map<string, ITaskAutomationChoice>();
	for (const row of rows) {
		const value = String(row?.value ?? '').trim();
		if (!value || byValue.has(value)) continue;
		byValue.set(value, { value, label: (row.name ?? '').trim() || value });
	}
	for (const choice of DEFAULT_PRIORITY_CHOICES) {
		if (!byValue.has(choice.value)) byValue.set(choice.value, choice);
	}
	return [...byValue.values()];
}

/** A person's name: the user's first and last name, else the employee's full name, else the email. */
export function employeeName(employee: Pick<IEmployee, 'fullName' | 'user'> | null | undefined): string {
	const user = employee?.user;
	const name = [user?.firstName, user?.lastName].filter((part) => !!part && String(part).trim()).join(' ');
	return name || employee?.fullName || user?.name || user?.email || '';
}

/** A task as the dry-run picker shows it: `API-12 Ship the release notes`. */
export function taskChoice(task: Pick<ITask, 'id' | 'title' | 'prefix' | 'number'>): ITaskAutomationChoice {
	const reference = task.prefix && task.number !== null && task.number !== undefined ? `${task.prefix}-${task.number}` : null;
	return { value: String(task.id), label: task.title || String(task.id), detail: reference };
}

/**
 * The organization's statuses, priorities, labels, people, projects and teams, for the pickers of Settings →
 * Automations, and its newest tasks for the dry run. Read through the platform's own routes, so each list needs the
 * permission its route needs: a list the user may not read is empty (the editor then shows the values a rule already
 * names), never an error of the page.
 */
@Injectable({ providedIn: 'root' })
export class TaskAutomationsDirectoryService {
	private readonly http = inject(HttpClient);

	/**
	 * The statuses of the organization, or — with a scope — those of a project or a team (the route answers the
	 * organization-wide rows when neither is named, so a project's own statuses need their own request).
	 */
	statuses(organizationId: ID, tenantId: ID, scope: ITaskAutomationScope = {}): Observable<ITaskAutomationChoice[]> {
		return this.http
			.get<IPagination<ITaskStatus>>(`${API_PREFIX}/task-statuses`, {
				params: toParams({ organizationId, tenantId, ...scopeParams(scope) })
			})
			.pipe(
				map((page) => statusChoices(page?.items ?? [])),
				catchError(() => of(statusChoices([])))
			);
	}

	/** The priorities of the organization, or of a project or a team (as {@link statuses}). */
	priorities(organizationId: ID, tenantId: ID, scope: ITaskAutomationScope = {}): Observable<ITaskAutomationChoice[]> {
		return this.http
			.get<IPagination<ITaskPriority>>(`${API_PREFIX}/task-priorities`, {
				params: toParams({ organizationId, tenantId, ...scopeParams(scope) })
			})
			.pipe(
				map((page) => priorityChoices(page?.items ?? [])),
				catchError(() => of(priorityChoices([])))
			);
	}

	tags(organizationId: ID, tenantId: ID): Observable<ITaskAutomationChoice[]> {
		return this.http
			.get<IPagination<ITag>>(`${API_PREFIX}/tags/level`, { params: toParams({ organizationId, tenantId }) })
			.pipe(
				map((page) =>
					(page?.items ?? [])
						.filter((tag) => !!tag?.id)
						.map((tag) => ({ value: String(tag.id), label: tag.name || String(tag.id) }))
						.sort(byLabel)
				),
				catchError(() => of([] as ITaskAutomationChoice[]))
			);
	}

	employees(organizationId: ID, tenantId: ID): Observable<ITaskAutomationChoice[]> {
		return this.http
			.get<IPagination<IEmployee>>(`${API_PREFIX}/employee`, {
				params: toParams({ relations: ['user'], where: { organizationId, tenantId } })
			})
			.pipe(
				map((page) =>
					(page?.items ?? [])
						.filter((employee) => !!employee?.id)
						.map((employee) => ({
							value: String(employee.id),
							label: employeeName(employee) || String(employee.id),
							detail: employee.user?.email ?? null
						}))
						.sort(byLabel)
				),
				catchError(() => of([] as ITaskAutomationChoice[]))
			);
	}

	projects(organizationId: ID, tenantId: ID): Observable<ITaskAutomationChoice[]> {
		return this.http
			.get<IPagination<IOrganizationProject>>(`${API_PREFIX}/organization-projects`, {
				params: toParams({ where: { organizationId, tenantId } })
			})
			.pipe(
				map((page) =>
					(page?.items ?? [])
						.filter((project) => !!project?.id)
						.map((project) => ({ value: String(project.id), label: (project.name ?? '').trim() || String(project.id) }))
						.sort(byLabel)
				),
				catchError(() => of([] as ITaskAutomationChoice[]))
			);
	}

	teams(organizationId: ID, tenantId: ID): Observable<ITaskAutomationChoice[]> {
		return this.http
			.get<IPagination<IOrganizationTeam>>(`${API_PREFIX}/organization-team`, {
				params: toParams({ where: { organizationId, tenantId } })
			})
			.pipe(
				map((page) =>
					(page?.items ?? [])
						.filter((team) => !!team?.id)
						.map((team) => ({ value: String(team.id), label: team.name || String(team.id) }))
						.sort(byLabel)
				),
				catchError(() => of([] as ITaskAutomationChoice[]))
			);
	}

	/**
	 * The organization's newest tasks, for the dry run (`GET /api/tasks`, not `/tasks/:id`: that read counts as a visit);
	 * the page filters them by title as the user types.
	 */
	tasks(organizationId: ID, tenantId: ID): Observable<ITaskAutomationChoice[]> {
		return this.http
			.get<IPagination<ITask>>(`${API_PREFIX}/tasks`, {
				params: toParams({ where: { organizationId, tenantId }, order: { updatedAt: 'DESC' }, take: TASK_AUTOMATIONS_TEST_TASKS })
			})
			.pipe(
				map((page) => (page?.items ?? []).filter((task) => !!task?.id).map(taskChoice)),
				catchError(() => of([] as ITaskAutomationChoice[]))
			);
	}
}
