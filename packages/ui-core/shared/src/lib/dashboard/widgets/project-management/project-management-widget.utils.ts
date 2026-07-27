import { ID, IOrganizationProject, ITask, TaskStatusEnum } from '@gauzy/contracts';
// Type-only import: this module must stay free of cross-package runtime
// dependencies so it can be unit tested without an Angular TestBed.
import type { IDashboardWidgetContext } from '@gauzy/ui-core/core';
import { IProjectManagementSnapshot } from './project-management-dashboard.types';

/**
 * Stable fingerprint of everything the task page actually depends on.
 *
 * Used both as the cache key of `ProjectManagementTasksService` and as the
 * `distinctUntilChanged` comparator of the widgets.
 *
 * NOTE — the reporting window is deliberately NOT part of this key. The legacy
 * `ProjectManagementDetailsComponent` builds its request from organization,
 * tenant, employee and project only; it never filters tasks by the date range
 * picker. Adding the dates here would make every widget refetch an answer that
 * cannot have changed, and would advertise a filtering the numbers do not
 * honour. It is also why these widgets need no serialized-date guard: they
 * never read `startDate` / `endDate`, so a bookmark-restored context (whose
 * dates arrive as ISO STRINGS, not `Date`s) cannot break the comparator.
 *
 * @param context - The ambient dashboard widget context.
 * @returns A deterministic key.
 */
export function projectManagementScopeKey(context: IDashboardWidgetContext | null): string {
	if (!context) {
		return '';
	}

	return [
		context.tenantId ?? '',
		context.organizationId ?? '',
		scopedId(context.employeeIds) ?? '',
		scopedId(context.projectIds) ?? ''
	].join('|');
}

/**
 * The single id the tasks endpoints accept out of a context scope list.
 *
 * `/tasks/employee` and `/tasks/pagination` both take ONE employee and ONE
 * project — they have no "in" form. The ambient dashboard context never carries
 * more than one of each (the page selectors are single-select), but a placement
 * pinned to several would; narrowing to the first is the only thing the API can
 * express, and it is at least deterministic.
 *
 * @param ids - The scope list from the context.
 * @returns The first id, or `null` when the scope is empty.
 */
export function scopedId(ids: ID[] | undefined): ID | null {
	return ids?.length ? ids[0] : null;
}

/**
 * Distinct projects of the given tasks, most-worked-on first.
 *
 * Reproduces `ProjectManagementDetailsComponent._sortProjectByPopularity`:
 * count the tasks per project, keep one entry per project, order by that count
 * descending. Rewritten as a pure function so it can be unit tested and so the
 * ranking is computed ONCE per fetch instead of once per widget.
 *
 * Tasks without a project are ignored rather than collapsed into a single
 * "unknown" bucket — the legacy panel links each row to a real project.
 *
 * @param tasks - The fetched page of tasks.
 * @returns Projects ordered by descending task count; ties keep first-seen order.
 */
export function sortProjectsByPopularity(tasks: ITask[]): IOrganizationProject[] {
	const counts = new Map<ID, number>();
	const projects: IOrganizationProject[] = [];

	for (const task of tasks ?? []) {
		const project = task?.project;
		// A project row without an id cannot be counted or de-duplicated; the
		// relation is either loaded (and has one) or absent.
		if (!project?.id) {
			continue;
		}

		const seen = counts.get(project.id);
		counts.set(project.id, (seen ?? 0) + 1);
		if (seen === undefined) {
			projects.push(project);
		}
	}

	// `Array.prototype.sort` is stable in every engine the app targets, so equal
	// counts keep the order the tasks introduced them in.
	return projects.sort((current, next) => (counts.get(next.id) ?? 0) - (counts.get(current.id) ?? 0));
}

/**
 * Open tasks of the given page, in the legacy "Recently Assigned" order.
 *
 * That order is literally the fetched page reversed: the page requests tasks by
 * `dueDate` ascending and the panel reverses the OPEN ones, so the rows with the
 * furthest due date surface first. Kept as-is for parity — the widget must show
 * the same rows in the same order as the panel it replaces.
 *
 * @param tasks - The fetched page of tasks.
 * @returns A new array; the input is never mutated.
 */
export function openTasksMostRecentFirst(tasks: ITask[]): ITask[] {
	// `filter` already allocates a new array, so reversing it in place cannot
	// scramble the caller's `tasks` (which the "Today" widget renders as fetched).
	return (tasks ?? []).filter((task: ITask) => task?.status === TaskStatusEnum.OPEN).reverse();
}

/**
 * Builds the snapshot every Project Management widget projects.
 *
 * Pure and side-effect free so the derivations can be tested without HTTP.
 *
 * @param tasks - The fetched page of tasks.
 * @param total - Total matching tasks reported by the server.
 * @returns The snapshot shared by all Project Management widgets.
 */
export function buildProjectManagementSnapshot(tasks: ITask[], total: number): IProjectManagementSnapshot {
	const items = tasks ?? [];

	return {
		tasks: items,
		// A malformed/absent total must not render as `NaN` in a "x of y" label.
		total: Number.isFinite(total) ? total : items.length,
		projects: sortProjectsByPopularity(items),
		assigned: openTasksMostRecentFirst(items)
	};
}
