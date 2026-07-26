import { PermissionsEnum } from '@gauzy/contracts';
import { WidgetRegistryConfig } from '@gauzy/ui-core/core';

/**
 * Namespaced widget ids for the Time Tracking counters.
 *
 * These strings are persisted inside every saved dashboard layout
 * (`IDashboardWidgetPlacement.widgetId`), so treat them as a public data
 * contract: renaming one orphans every placement that references it.
 */
export const TIME_TRACKING_WIDGET_IDS = {
	MEMBERS_WORKED: 'time-tracking.members-worked',
	PROJECTS_WORKED: 'time-tracking.projects-worked',
	TODAY_ACTIVITY: 'time-tracking.today-activity',
	WORKED_TODAY: 'time-tracking.worked-today',
	WORKED_THIS_WEEK: 'time-tracking.worked-this-week',
	WEEKLY_ACTIVITY: 'time-tracking.weekly-activity'
} as const;

/**
 * Every counter is a quarter-row tile by default (12-column grid → four per row),
 * matching the legacy Time Tracking widget strip.
 */
const COUNTER_DEFAULT_SIZE = { w: 3, h: 2 };
const COUNTER_MIN_SIZE = { w: 3, h: 2 };
const COUNTER_MAX_SIZE = { w: 12, h: 4 };

/** Widths a counter still reads well at. */
const COUNTER_SUPPORTED_WIDTHS: WidgetRegistryConfig['supportedWidths'] = [3, 4, 6, 12];

/**
 * All counters need an organization and a date range; none of them need a
 * specific employee, project or team (those merely narrow the numbers).
 */
const COUNTER_CONTEXT: WidgetRegistryConfig['contextRequirements'] = ['organization', 'dateRange'];

/**
 * Registry entries for the six Time Tracking counter widgets.
 *
 * Registered by the plugin (the integrator wires the
 * `WidgetRegistryService.registerWidgets` call) so they show up in the dashboard
 * builder's palette under the "Time tracking" category.
 *
 * Permissions mirror the legacy dashboard exactly: only "Members worked" was
 * gated (`*ngxPermissionsOnly="CHANGE_SELECTED_EMPLOYEE"`), because a user who
 * cannot switch employees only ever sees their own numbers, for which a member
 * head count is meaningless.
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
	}
];
