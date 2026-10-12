import { PermissionsEnum } from '@gauzy/contracts';
import { WidgetRegistryConfig } from '@gauzy/ui-core/core';

/**
 * Namespaced widget ids for the Time Tracking counters and list panels.
 *
 * These strings are persisted inside every saved dashboard layout
 * (`IDashboardWidgetPlacement.widgetId`), so treat them as a public data
 * contract: renaming one orphans every placement that references it.
 *
 * Note the deliberate pairing: `projects-worked` / `members-worked` are the
 * COUNTERS ("how many"), while `projects` / `members` are the list panels that
 * break the same range down row by row.
 */
export const TIME_TRACKING_WIDGET_IDS = {
	MEMBERS_WORKED: 'time-tracking.members-worked',
	PROJECTS_WORKED: 'time-tracking.projects-worked',
	TODAY_ACTIVITY: 'time-tracking.today-activity',
	WORKED_TODAY: 'time-tracking.worked-today',
	WORKED_THIS_WEEK: 'time-tracking.worked-this-week',
	WEEKLY_ACTIVITY: 'time-tracking.weekly-activity',
	RECENT_ACTIVITIES: 'time-tracking.recent-activities',
	MANUAL_TIME: 'time-tracking.manual-time',
	TASKS: 'time-tracking.tasks',
	PROJECTS: 'time-tracking.projects',
	APPS_URLS: 'time-tracking.apps-urls',
	MEMBERS: 'time-tracking.members'
} as const;

/**
 * Every counter is a compact single-row tile by default (12-column grid → four
 * per row), matching the legacy Time Tracking widget strip.
 */
const COUNTER_DEFAULT_SIZE = { w: 3, h: 1 };
const COUNTER_MIN_SIZE = { w: 3, h: 1 };
const COUNTER_MAX_SIZE = { w: 12, h: 4 };

/** Widths a counter still reads well at. */
const COUNTER_SUPPORTED_WIDTHS: WidgetRegistryConfig['supportedWidths'] = [3, 4, 6, 12];

/**
 * The list panels need real estate the counters do not: half a row wide and
 * four units tall shows a handful of rows before the list starts scrolling
 * inside the card (which it does — it never grows past its grid cell).
 */
const PANEL_DEFAULT_SIZE = { w: 6, h: 4 };
const PANEL_MIN_SIZE = { w: 4, h: 3 };
const PANEL_MAX_SIZE = { w: 12, h: 8 };

/** Widths a multi-column list still reads well at. */
const PANEL_SUPPORTED_WIDTHS: WidgetRegistryConfig['supportedWidths'] = [4, 6, 8, 12];

/**
 * All Time Tracking widgets need an organization and a date range; none of them
 * need a specific employee, project or team (those merely narrow the numbers).
 */
const COUNTER_CONTEXT: WidgetRegistryConfig['contextRequirements'] = ['organization', 'dateRange'];

/**
 * Registry entries for the Time Tracking widgets — six counters and the five
 * richer "window" panels the legacy dashboard renders below them.
 *
 * Registered by the plugin (the integrator wires the
 * `WidgetRegistryService.registerWidgets` call) so they show up in the dashboard
 * builder's palette under the "Time tracking" category.
 *
 * Permissions mirror the legacy dashboard exactly: only the two member-shaped
 * widgets were gated (`*ngxPermissionsOnly="CHANGE_SELECTED_EMPLOYEE"` on the
 * "Members worked" counter and on the whole "Members" window, which
 * `getMembers()` re-checked before fetching), because a user who cannot switch
 * employees only ever sees their own numbers — for which a member breakdown is
 * meaningless. The remaining panels carried no permission check on the page and
 * carry none here; the API still scopes every response to what the caller may see.
 *
 * NOTE: the page ROUTE itself is not permission-guarded either — its only
 * `canActivate` is `standardDashboardGuard`, which restores the Standard layout
 * (see `dashboard-time-track-angular-ui.constants.ts`). The
 * `ADMIN_DASHBOARD_VIEW` / `TIME_TRACKING_DASHBOARD` pair on the plugin's TAB
 * governs tab visibility, not access to the data these widgets read, so it is
 * deliberately NOT copied onto the widgets.
 */
export const DASHBOARD_TIME_TRACK_WIDGETS: WidgetRegistryConfig[] = [
	{
		location: 'dashboard',
		category: 'time-tracking',
		widgetId: TIME_TRACKING_WIDGET_IDS.MEMBERS_WORKED,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.MEMBERS_WORKED.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.MEMBERS_WORKED.DESCRIPTION',
		icon: 'people-outline',
		defaultSize: COUNTER_DEFAULT_SIZE,
		minSize: COUNTER_MIN_SIZE,
		maxSize: COUNTER_MAX_SIZE,
		supportedWidths: COUNTER_SUPPORTED_WIDTHS,
		contextRequirements: COUNTER_CONTEXT,
		permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE],
		loadComponent: () => import('./members-worked-widget.component').then((m) => m.MembersWorkedWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'time-tracking',
		widgetId: TIME_TRACKING_WIDGET_IDS.PROJECTS_WORKED,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.PROJECTS_WORKED.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.PROJECTS_WORKED.DESCRIPTION',
		icon: 'briefcase-outline',
		defaultSize: COUNTER_DEFAULT_SIZE,
		minSize: COUNTER_MIN_SIZE,
		maxSize: COUNTER_MAX_SIZE,
		supportedWidths: COUNTER_SUPPORTED_WIDTHS,
		contextRequirements: COUNTER_CONTEXT,
		permissions: [],
		loadComponent: () => import('./projects-worked-widget.component').then((m) => m.ProjectsWorkedWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'time-tracking',
		widgetId: TIME_TRACKING_WIDGET_IDS.TODAY_ACTIVITY,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TODAY_ACTIVITY.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TODAY_ACTIVITY.DESCRIPTION',
		icon: 'activity-outline',
		defaultSize: COUNTER_DEFAULT_SIZE,
		minSize: COUNTER_MIN_SIZE,
		maxSize: COUNTER_MAX_SIZE,
		supportedWidths: COUNTER_SUPPORTED_WIDTHS,
		contextRequirements: COUNTER_CONTEXT,
		permissions: [],
		loadComponent: () => import('./today-activity-widget.component').then((m) => m.TodayActivityWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'time-tracking',
		widgetId: TIME_TRACKING_WIDGET_IDS.WORKED_TODAY,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.WORKED_TODAY.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.WORKED_TODAY.DESCRIPTION',
		icon: 'clock-outline',
		defaultSize: COUNTER_DEFAULT_SIZE,
		minSize: COUNTER_MIN_SIZE,
		maxSize: COUNTER_MAX_SIZE,
		supportedWidths: COUNTER_SUPPORTED_WIDTHS,
		contextRequirements: COUNTER_CONTEXT,
		permissions: [],
		loadComponent: () => import('./worked-today-widget.component').then((m) => m.WorkedTodayWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'time-tracking',
		widgetId: TIME_TRACKING_WIDGET_IDS.WORKED_THIS_WEEK,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.WORKED_THIS_WEEK.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.WORKED_THIS_WEEK.DESCRIPTION',
		icon: 'calendar-outline',
		defaultSize: COUNTER_DEFAULT_SIZE,
		minSize: COUNTER_MIN_SIZE,
		maxSize: COUNTER_MAX_SIZE,
		supportedWidths: COUNTER_SUPPORTED_WIDTHS,
		contextRequirements: COUNTER_CONTEXT,
		permissions: [],
		loadComponent: () => import('./worked-this-week-widget.component').then((m) => m.WorkedThisWeekWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'time-tracking',
		widgetId: TIME_TRACKING_WIDGET_IDS.WEEKLY_ACTIVITY,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.WEEKLY_ACTIVITY.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.WEEKLY_ACTIVITY.DESCRIPTION',
		icon: 'trending-up-outline',
		defaultSize: COUNTER_DEFAULT_SIZE,
		minSize: COUNTER_MIN_SIZE,
		maxSize: COUNTER_MAX_SIZE,
		supportedWidths: COUNTER_SUPPORTED_WIDTHS,
		contextRequirements: COUNTER_CONTEXT,
		permissions: [],
		loadComponent: () => import('./weekly-activity-widget.component').then((m) => m.WeeklyActivityWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'time-tracking',
		widgetId: TIME_TRACKING_WIDGET_IDS.RECENT_ACTIVITIES,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TIME_TRACKING_RECENT_ACTIVITIES.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TIME_TRACKING_RECENT_ACTIVITIES.DESCRIPTION',
		icon: 'camera-outline',
		// Taller than the other panels: a row is a screenshot thumbnail plus its
		// activity bar, and one member's carousel already needs most of that height.
		defaultSize: { w: 8, h: 5 },
		minSize: { w: 4, h: 4 },
		maxSize: PANEL_MAX_SIZE,
		supportedWidths: PANEL_SUPPORTED_WIDTHS,
		contextRequirements: COUNTER_CONTEXT,
		// No permission check, exactly like the legacy "Recent Activities" window: a user
		// without CHANGE_SELECTED_EMPLOYEE still sees their OWN screenshots (the
		// API scopes the response), they just do not get the member avatar or the
		// per-member "View all" jump — both gated inside the widget.
		permissions: [],
		loadComponent: () =>
			import('./recent-activities-widget.component').then((m) => m.RecentActivitiesWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'time-tracking',
		widgetId: TIME_TRACKING_WIDGET_IDS.MANUAL_TIME,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TIME_TRACKING_MANUAL_TIME.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TIME_TRACKING_MANUAL_TIME.DESCRIPTION',
		icon: 'edit-2-outline',
		defaultSize: PANEL_DEFAULT_SIZE,
		minSize: PANEL_MIN_SIZE,
		maxSize: PANEL_MAX_SIZE,
		supportedWidths: PANEL_SUPPORTED_WIDTHS,
		contextRequirements: COUNTER_CONTEXT,
		permissions: [],
		loadComponent: () => import('./manual-time-widget.component').then((m) => m.ManualTimeWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'time-tracking',
		widgetId: TIME_TRACKING_WIDGET_IDS.TASKS,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TIME_TRACKING_TASKS.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TIME_TRACKING_TASKS.DESCRIPTION',
		icon: 'checkmark-square-outline',
		defaultSize: PANEL_DEFAULT_SIZE,
		minSize: PANEL_MIN_SIZE,
		maxSize: PANEL_MAX_SIZE,
		supportedWidths: PANEL_SUPPORTED_WIDTHS,
		contextRequirements: COUNTER_CONTEXT,
		permissions: [],
		loadComponent: () => import('./tasks-list-widget.component').then((m) => m.TasksListWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'time-tracking',
		widgetId: TIME_TRACKING_WIDGET_IDS.PROJECTS,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TIME_TRACKING_PROJECTS.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TIME_TRACKING_PROJECTS.DESCRIPTION',
		icon: 'list-outline',
		defaultSize: PANEL_DEFAULT_SIZE,
		minSize: PANEL_MIN_SIZE,
		maxSize: PANEL_MAX_SIZE,
		supportedWidths: PANEL_SUPPORTED_WIDTHS,
		contextRequirements: COUNTER_CONTEXT,
		permissions: [],
		loadComponent: () => import('./projects-list-widget.component').then((m) => m.ProjectsListWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'time-tracking',
		widgetId: TIME_TRACKING_WIDGET_IDS.APPS_URLS,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TIME_TRACKING_APPS_URLS.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TIME_TRACKING_APPS_URLS.DESCRIPTION',
		icon: 'monitor-outline',
		defaultSize: PANEL_DEFAULT_SIZE,
		minSize: PANEL_MIN_SIZE,
		maxSize: PANEL_MAX_SIZE,
		supportedWidths: PANEL_SUPPORTED_WIDTHS,
		contextRequirements: COUNTER_CONTEXT,
		permissions: [],
		loadComponent: () => import('./apps-urls-widget.component').then((m) => m.AppsUrlsWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'time-tracking',
		widgetId: TIME_TRACKING_WIDGET_IDS.MEMBERS,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TIME_TRACKING_MEMBERS.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.TIME_TRACKING_MEMBERS.DESCRIPTION',
		icon: 'people-outline',
		defaultSize: PANEL_DEFAULT_SIZE,
		minSize: PANEL_MIN_SIZE,
		maxSize: PANEL_MAX_SIZE,
		supportedWidths: PANEL_SUPPORTED_WIDTHS,
		contextRequirements: COUNTER_CONTEXT,
		// Same gate the legacy "Members" window carried, and the same one the
		// "Members worked" counter above uses.
		permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE],
		loadComponent: () => import('./members-list-widget.component').then((m) => m.MembersListWidgetComponent)
	}
];
