import { IOrganizationProject, ITask } from '@gauzy/contracts';

/**
 * Everything the Project Management widgets render, derived from ONE task page.
 *
 * The legacy `ProjectManagementDetailsComponent` builds all three of its
 * data-driven panels — Today, Most Viewed Projects and Recently Assigned — from
 * a single `tasks` array it keeps in memory, so the widgets share one snapshot
 * rather than each issuing its own request.
 */
export interface IProjectManagementSnapshot {
	/**
	 * The fetched page of tasks, in server order (`dueDate` ascending).
	 *
	 * This is what the "Today" panel lists.
	 */
	readonly tasks: ITask[];

	/**
	 * Total number of tasks matching the scope, as reported by the server.
	 *
	 * Only one page is fetched (see `PROJECT_MANAGEMENT_TASKS_PAGE_SIZE`), so
	 * this is what lets a widget say "showing 100 of 340" instead of implying the
	 * page is everything.
	 */
	readonly total: number;

	/**
	 * Distinct projects of the fetched tasks, most-worked-on first.
	 *
	 * Ranked by how many of the fetched tasks belong to each project — the same
	 * "popularity" heuristic the legacy page uses for its Most Viewed Projects
	 * panel. It is therefore a ranking over the SAMPLE, not over the whole task
	 * table.
	 */
	readonly projects: IOrganizationProject[];

	/**
	 * Open tasks of the fetched page, in the legacy panel's order.
	 *
	 * @see openTasksMostRecentFirst for what that order actually is.
	 */
	readonly assigned: ITask[];
}
