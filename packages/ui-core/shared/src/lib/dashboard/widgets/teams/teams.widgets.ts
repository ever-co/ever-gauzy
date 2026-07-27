import { PermissionsEnum } from '@gauzy/contracts';
import { WidgetRegistryConfig } from '@gauzy/ui-core/core';

/**
 * Namespaced widget ids for the Teams dashboard.
 *
 * These strings are persisted inside every saved dashboard layout
 * (`IDashboardWidgetPlacement.widgetId`), so treat them as a public data
 * contract: renaming one orphans every placement that references it.
 */
export const TEAMS_WIDGET_IDS = {
	COUNT: 'teams.count',
	MEMBERS_WORKED: 'teams.members-worked',
	PROJECTS_WORKED: 'teams.projects-worked',
	ACTIVITY: 'teams.activity',
	TEAM_CARDS: 'teams.team-cards',
	TEAM_MEMBERS: 'teams.team-members',
	STATUS_CHART: 'teams.status-chart',
	DATA_ENTRY_SHORTCUTS: 'shortcuts.data-entry'
} as const;

/**
 * Every counter is a quarter-row tile by default (12-column grid → four per row),
 * matching the legacy Teams dashboard's widget strip.
 */
const COUNTER_DEFAULT_SIZE = { w: 3, h: 2 };
const COUNTER_MIN_SIZE = { w: 3, h: 2 };
const COUNTER_MAX_SIZE = { w: 12, h: 4 };

/** Widths a counter still reads well at. */
const COUNTER_SUPPORTED_WIDTHS: WidgetRegistryConfig['supportedWidths'] = [3, 4, 6, 12];

/**
 * Every Teams widget needs an organization and a date range; the employee and
 * team scopes merely narrow the numbers, so they are not requirements.
 */
const TEAMS_CONTEXT: WidgetRegistryConfig['contextRequirements'] = ['organization', 'dateRange'];

/**
 * Permissions of the Teams dashboard route.
 *
 * Copied verbatim from the `teams` route in `dashboard.routes.ts`
 * (`permissions.only`), and evaluated the same way the guard evaluates it:
 * `WidgetRegistryService` consumers call `Store.hasAnyPermission`, so holding
 * EITHER permission is enough — exactly like `PermissionsGuard`.
 */
const TEAMS_PERMISSIONS: PermissionsEnum[] = [PermissionsEnum.ADMIN_DASHBOARD_VIEW, PermissionsEnum.TEAM_DASHBOARD];

/**
 * Registry entries for the Teams dashboard widgets.
 *
 * The integrator wires the `WidgetRegistryService.registerWidgets` call; these
 * entries only describe the widgets so they show up in the dashboard builder's
 * palette under the "Teams" category.
 *
 * The last entry is the odd one out: the data-entry shortcuts are a navigation
 * widget with nothing to do with teams, so it is categorized as `other` and
 * carries the accounting permissions of the pages it links to. It lives in this
 * file because it was wrapped as a widget in the same pass — moving it to an
 * accounting bundle later only requires moving the entry, not the id.
 */
export const TEAMS_DASHBOARD_WIDGETS: WidgetRegistryConfig[] = [
	{
		location: 'dashboard',
		category: 'teams',
		widgetId: TEAMS_WIDGET_IDS.COUNT,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TEAMS_COUNT.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TEAMS_COUNT.DESCRIPTION',
		icon: 'people-outline',
		defaultSize: COUNTER_DEFAULT_SIZE,
		minSize: COUNTER_MIN_SIZE,
		maxSize: COUNTER_MAX_SIZE,
		supportedWidths: COUNTER_SUPPORTED_WIDTHS,
		contextRequirements: TEAMS_CONTEXT,
		permissions: TEAMS_PERMISSIONS,
		loadComponent: () => import('./teams-count-widget.component').then((m) => m.TeamsCountWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'teams',
		widgetId: TEAMS_WIDGET_IDS.MEMBERS_WORKED,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TEAMS_MEMBERS_WORKED.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TEAMS_MEMBERS_WORKED.DESCRIPTION',
		icon: 'person-done-outline',
		defaultSize: COUNTER_DEFAULT_SIZE,
		minSize: COUNTER_MIN_SIZE,
		maxSize: COUNTER_MAX_SIZE,
		supportedWidths: COUNTER_SUPPORTED_WIDTHS,
		contextRequirements: TEAMS_CONTEXT,
		permissions: TEAMS_PERMISSIONS,
		loadComponent: () =>
			import('./teams-members-worked-widget.component').then((m) => m.TeamsMembersWorkedWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'teams',
		widgetId: TEAMS_WIDGET_IDS.PROJECTS_WORKED,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TEAMS_PROJECTS_WORKED.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TEAMS_PROJECTS_WORKED.DESCRIPTION',
		icon: 'briefcase-outline',
		defaultSize: COUNTER_DEFAULT_SIZE,
		minSize: COUNTER_MIN_SIZE,
		maxSize: COUNTER_MAX_SIZE,
		supportedWidths: COUNTER_SUPPORTED_WIDTHS,
		contextRequirements: TEAMS_CONTEXT,
		permissions: TEAMS_PERMISSIONS,
		loadComponent: () =>
			import('./teams-projects-worked-widget.component').then((m) => m.TeamsProjectsWorkedWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'teams',
		widgetId: TEAMS_WIDGET_IDS.ACTIVITY,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TEAMS_ACTIVITY.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TEAMS_ACTIVITY.DESCRIPTION',
		icon: 'activity-outline',
		defaultSize: COUNTER_DEFAULT_SIZE,
		minSize: COUNTER_MIN_SIZE,
		maxSize: COUNTER_MAX_SIZE,
		supportedWidths: COUNTER_SUPPORTED_WIDTHS,
		contextRequirements: TEAMS_CONTEXT,
		permissions: TEAMS_PERMISSIONS,
		loadComponent: () => import('./teams-activity-widget.component').then((m) => m.TeamsActivityWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'teams',
		widgetId: TEAMS_WIDGET_IDS.TEAM_CARDS,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TEAM_CARDS.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TEAM_CARDS.DESCRIPTION',
		icon: 'grid-outline',
		// A card grid needs room: half a row wide and four units tall shows two
		// columns of cards without scrolling.
		defaultSize: { w: 6, h: 4 },
		minSize: { w: 4, h: 3 },
		maxSize: { w: 12, h: 8 },
		supportedWidths: [4, 6, 8, 12],
		contextRequirements: TEAMS_CONTEXT,
		permissions: TEAMS_PERMISSIONS,
		loadComponent: () => import('./team-cards-widget.component').then((m) => m.TeamCardsWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'teams',
		widgetId: TEAMS_WIDGET_IDS.TEAM_MEMBERS,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TEAM_MEMBERS.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TEAM_MEMBERS.DESCRIPTION',
		icon: 'people-outline',
		defaultSize: { w: 6, h: 4 },
		minSize: { w: 4, h: 3 },
		maxSize: { w: 12, h: 8 },
		supportedWidths: [4, 6, 8, 12],
		contextRequirements: TEAMS_CONTEXT,
		permissions: TEAMS_PERMISSIONS,
		loadComponent: () => import('./team-members-widget.component').then((m) => m.TeamMembersWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'teams',
		widgetId: TEAMS_WIDGET_IDS.STATUS_CHART,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TEAM_STATUS_CHART.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TEAM_STATUS_CHART.DESCRIPTION',
		icon: 'pie-chart-outline',
		// A doughnut plus its bottom legend needs height more than width.
		defaultSize: { w: 4, h: 4 },
		minSize: { w: 3, h: 3 },
		maxSize: { w: 12, h: 8 },
		supportedWidths: [3, 4, 6, 12],
		contextRequirements: TEAMS_CONTEXT,
		permissions: TEAMS_PERMISSIONS,
		loadComponent: () =>
			import('./team-status-chart-widget.component').then((m) => m.TeamStatusChartWidgetComponent)
	},
	{
		location: 'dashboard',
		// Not a Teams widget: it links into Accounting. Categorized honestly so the
		// palette groups it where a user would look for it.
		category: 'other',
		widgetId: TEAMS_WIDGET_IDS.DATA_ENTRY_SHORTCUTS,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.DATA_ENTRY_SHORTCUTS.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.DATA_ENTRY_SHORTCUTS.DESCRIPTION',
		icon: 'flash-outline',
		defaultSize: { w: 6, h: 3 },
		minSize: { w: 3, h: 2 },
		maxSize: { w: 12, h: 6 },
		supportedWidths: [3, 4, 6, 8, 12],
		// Pure navigation: it renders the same tiles whatever the range or scope.
		contextRequirements: [],
		// The tiles open the Income / Expenses / recurring-expense create dialogs,
		// so a user needs the view permission of at least one of them for the
		// widget to show anything. The tiles themselves additionally check the
		// matching EDIT permission, and the employee recurring-expense tile checks
		// the EMPLOYEE (not organization) pair its page is guarded by.
		permissions: [
			PermissionsEnum.ORG_INCOMES_VIEW,
			PermissionsEnum.ORG_EXPENSES_VIEW,
			PermissionsEnum.EMPLOYEE_EXPENSES_VIEW
		],
		loadComponent: () =>
			import('./data-entry-shortcuts-widget.component').then((m) => m.DataEntryShortcutsWidgetComponent)
	}
];
