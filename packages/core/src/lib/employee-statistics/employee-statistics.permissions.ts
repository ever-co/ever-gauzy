import { PermissionsEnum } from '@gauzy/contracts';

/**
 * Who may read the employee statistics: exactly who may open the dashboard tab that shows them.
 *
 * The four `/employee-statistics` reads answer money — what employees earned, spent, were paid as a bonus and
 * brought in as profit, and the income and expense lines behind those sums. They stated no permission
 * (GHSA-v79w-54p2-wmh5 backlog; owner decision 2, 2026-10-22), and `PermissionGuard` answers `true` to a route
 * that states none, so any signed-in member of the tenant could read them, VIEWER and CANDIDATE included.
 *
 * The UI already decides who reads them, and the API now states the same rule. `DashboardComponent` registers
 * the Accounting tab (the organization aggregate) with `[ADMIN_DASHBOARD_VIEW, ACCOUNTING_DASHBOARD]` and the
 * Human Resources tab (one employee's months, series and history) with `[ADMIN_DASHBOARD_VIEW,
 * HUMAN_RESOURCE_DASHBOARD]`, and the dashboard widgets built from those pages carry the same pairs. The tab
 * registry, the widget palette and `PermissionGuard` all read a list as "any of", so each route below is reachable
 * by exactly the roles that can open the page that calls it — no wider (the income and expense view grants
 * would widen it: they are held by roles the pages are not shown to) and no narrower (an employee holds
 * `ADMIN_DASHBOARD_VIEW` and `HUMAN_RESOURCE_DASHBOARD` by default, so their own Human Resources figures stay
 * reachable).
 */

/** The organization aggregate: the Accounting dashboard tab's pair. */
export const EMPLOYEE_STATISTICS_AGGREGATE_PERMISSIONS: readonly PermissionsEnum[] = Object.freeze([
	PermissionsEnum.ADMIN_DASHBOARD_VIEW,
	PermissionsEnum.ACCOUNTING_DASHBOARD
]);

/** One employee's series, months and history: the Human Resources dashboard tab's pair. */
export const EMPLOYEE_STATISTICS_EMPLOYEE_PERMISSIONS: readonly PermissionsEnum[] = Object.freeze([
	PermissionsEnum.ADMIN_DASHBOARD_VIEW,
	PermissionsEnum.HUMAN_RESOURCE_DASHBOARD
]);
