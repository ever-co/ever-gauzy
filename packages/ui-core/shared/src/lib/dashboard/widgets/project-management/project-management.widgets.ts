import { PermissionsEnum } from '@gauzy/contracts';
import { WidgetRegistryConfig } from '@gauzy/ui-core/core';

/**
 * Namespaced widget ids for the Project Management dashboard.
 *
 * These strings are persisted inside every saved dashboard layout
 * (`IDashboardWidgetPlacement.widgetId`), so treat them as a public data
 * contract: renaming one orphans every placement that references it.
 */
export const PROJECT_MANAGEMENT_WIDGET_IDS = {
	MY_TASKS: 'project-management.my-tasks',
	MOST_VIEWED_PROJECTS: 'project-management.most-viewed-projects',
	RECENTLY_ASSIGNED: 'project-management.recently-assigned',
	INBOX: 'project-management.inbox'
} as const;

/**
 * A list card needs height more than width: four rows and a footer fit in the
 * default footprint, and the list scrolls inside the card beyond that.
 */
const LIST_DEFAULT_SIZE = { w: 4, h: 4 };
const LIST_MIN_SIZE = { w: 3, h: 3 };
const LIST_MAX_SIZE = { w: 12, h: 8 };

/** Widths a task/project list still reads well at. */
const LIST_SUPPORTED_WIDTHS: WidgetRegistryConfig['supportedWidths'] = [3, 4, 6, 8, 12];

/**
 * Every data-driven Project Management widget needs an organization; the
 * employee and project scopes merely narrow the rows, so they are not
 * requirements.
 *
 * `dateRange` is deliberately absent. The legacy panel's task query is scoped by
 * organization / employee / project only — it never filters by the reporting
 * window — so declaring the requirement would promise a filtering these widgets
 * do not (and cannot) honour.
 */
const PROJECT_MANAGEMENT_CONTEXT: WidgetRegistryConfig['contextRequirements'] = ['organization'];

/**
 * Permissions of the Project Management dashboard route.
 *
 * Copied verbatim from the `project-management` route in `dashboard.routes.ts`
 * (`data.permissions.only`), and evaluated the same way the guard evaluates it:
 * `WidgetRegistryService` consumers call `Store.hasAnyPermission`, so holding
 * EITHER permission is enough — exactly like `PermissionsGuard`.
 */
const PROJECT_MANAGEMENT_PERMISSIONS: PermissionsEnum[] = [
	PermissionsEnum.ADMIN_DASHBOARD_VIEW,
	PermissionsEnum.PROJECT_MANAGEMENT_DASHBOARD
];

/**
 * Registry entries for the Project Management dashboard widgets.
 *
 * The integrator wires the `WidgetRegistryService.registerWidgets` call; these
 * entries only describe the widgets so they show up in the dashboard builder's
 * palette under the "Project Management" category.
 *
 * This module holds config objects ONLY — every component is reached through a
 * dynamic `loadComponent` import, which is what keeps the widgets out of the
 * root bundle that `provideCoreDashboardWidgets()` is referenced from.
 */
export const PROJECT_MANAGEMENT_DASHBOARD_WIDGETS: WidgetRegistryConfig[] = [
	{
		location: 'dashboard',
		category: 'project-management',
		widgetId: PROJECT_MANAGEMENT_WIDGET_IDS.MY_TASKS,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.PROJECT_MANAGEMENT.MY_TASKS.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.PROJECT_MANAGEMENT.MY_TASKS.DESCRIPTION',
		icon: 'checkmark-square-outline',
		defaultSize: LIST_DEFAULT_SIZE,
		minSize: LIST_MIN_SIZE,
		maxSize: LIST_MAX_SIZE,
		supportedWidths: LIST_SUPPORTED_WIDTHS,
		contextRequirements: PROJECT_MANAGEMENT_CONTEXT,
		permissions: PROJECT_MANAGEMENT_PERMISSIONS,
		loadComponent: () => import('./my-tasks-widget.component').then((m) => m.MyTasksWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'project-management',
		widgetId: PROJECT_MANAGEMENT_WIDGET_IDS.MOST_VIEWED_PROJECTS,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.PROJECT_MANAGEMENT.MOST_VIEWED_PROJECTS.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.PROJECT_MANAGEMENT.MOST_VIEWED_PROJECTS.DESCRIPTION',
		icon: 'briefcase-outline',
		defaultSize: LIST_DEFAULT_SIZE,
		minSize: LIST_MIN_SIZE,
		maxSize: LIST_MAX_SIZE,
		supportedWidths: LIST_SUPPORTED_WIDTHS,
		contextRequirements: PROJECT_MANAGEMENT_CONTEXT,
		permissions: PROJECT_MANAGEMENT_PERMISSIONS,
		loadComponent: () =>
			import('./most-viewed-projects-widget.component').then((m) => m.MostViewedProjectsWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'project-management',
		widgetId: PROJECT_MANAGEMENT_WIDGET_IDS.RECENTLY_ASSIGNED,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.PROJECT_MANAGEMENT.RECENTLY_ASSIGNED.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.PROJECT_MANAGEMENT.RECENTLY_ASSIGNED.DESCRIPTION',
		icon: 'inbox-outline',
		defaultSize: LIST_DEFAULT_SIZE,
		minSize: LIST_MIN_SIZE,
		maxSize: LIST_MAX_SIZE,
		supportedWidths: LIST_SUPPORTED_WIDTHS,
		contextRequirements: PROJECT_MANAGEMENT_CONTEXT,
		permissions: PROJECT_MANAGEMENT_PERMISSIONS,
		loadComponent: () =>
			import('./recently-assigned-widget.component').then((m) => m.RecentlyAssignedWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'project-management',
		widgetId: PROJECT_MANAGEMENT_WIDGET_IDS.INBOX,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.PROJECT_MANAGEMENT.INBOX.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.PROJECT_MANAGEMENT.INBOX.DESCRIPTION',
		icon: 'email-outline',
		// Smaller by default than its siblings: it has nothing to list, so a
		// full-height card would just be a lot of empty space.
		defaultSize: { w: 4, h: 2 },
		minSize: { w: 3, h: 2 },
		maxSize: LIST_MAX_SIZE,
		supportedWidths: LIST_SUPPORTED_WIDTHS,
		// Renders the same placeholder whatever the organization or scope.
		contextRequirements: [],
		permissions: PROJECT_MANAGEMENT_PERMISSIONS,
		loadComponent: () => import('./inbox-widget.component').then((m) => m.InboxWidgetComponent)
	}
];
