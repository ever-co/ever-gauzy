import { PermissionsEnum } from '@gauzy/contracts';
import { WidgetRegistryConfig } from '@gauzy/ui-core/core';
// The DEPENDENCY-FREE constants module, never `employee-chart.utils`. This file
// is reachable from the root bootstrap through `provideCoreDashboardWidgets()`,
// so whatever it imports lands in the INITIAL bundle: importing the utils here
// would drag the Chart.js dataset builders (and `@gauzy/ui-config`) in eagerly
// and undo the `loadComponent` lazy imports below.
import {
	EMPLOYEE_CHART_KINDS,
	EMPLOYEE_CHART_KIND_LABELS,
	EMPLOYEE_CHART_TYPE_CONFIG_KEY,
	EmployeeChartKind
} from './employee-chart.constants';

/**
 * Namespaced widget ids for the employee statistics charts.
 *
 * These strings are persisted inside every saved dashboard layout
 * (`IDashboardWidgetPlacement.widgetId`), so treat them as a public data
 * contract: renaming one orphans every placement that references it.
 */
export const CHART_WIDGET_IDS = {
	EMPLOYEE_DOUGHNUT: 'charts.employee-doughnut',
	EMPLOYEE_HORIZONTAL_BAR: 'charts.employee-horizontal-bar',
	EMPLOYEE_STACKED_BAR: 'charts.employee-stacked-bar',
	EMPLOYEE_STATISTICS: 'charts.employee-statistics'
} as const;

/**
 * Half a row by default (12 column grid) and four rows tall.
 *
 * The canvas' rows are 80px, so four rows give the plot ~320px — enough for a
 * legend plus a readable set of bars, which is roughly where the HR dashboard's
 * own 500px-square charts start to look sensible once the fixed size is dropped.
 */
const CHART_DEFAULT_SIZE = { w: 6, h: 4 };

/**
 * Below three rows the legend eats the plot, and below four columns the month
 * labels of the bar charts collide. Advisory — the host only uses it to narrow
 * the widths offered in the resize menu.
 */
const CHART_MIN_SIZE = { w: 4, h: 3 };
const CHART_MAX_SIZE = { w: 12, h: 10 };

/** Widths a chart still reads well at. A 3-column chart is unreadable. */
const CHART_SUPPORTED_WIDTHS: WidgetRegistryConfig['supportedWidths'] = [4, 6, 8, 12];

/**
 * Every chart needs an organization, a date range AND an employee.
 *
 * `/employee-statistics/months` is per-employee: with the page selector on "All
 * employees" there is nothing to query, and the widget says so rather than
 * rendering an empty plot.
 */
const CHART_CONTEXT: WidgetRegistryConfig['contextRequirements'] = ['organization', 'dateRange', 'employee'];

/**
 * Permissions mirror the source page exactly.
 *
 * The charts live on the HR dashboard tab, which `DashboardComponent` registers
 * with `[ADMIN_DASHBOARD_VIEW, HUMAN_RESOURCE_DASHBOARD]`. The widget host
 * checks these with `hasAnyPermission`, matching the tab registry's own "any of"
 * semantics — so a user who can reach the HR tab can place these widgets, and
 * nobody else can.
 */
const CHART_PERMISSIONS = [PermissionsEnum.ADMIN_DASHBOARD_VIEW, PermissionsEnum.HUMAN_RESOURCE_DASHBOARD];

/**
 * Registry entries for the four employee statistics chart widgets.
 *
 * Registered by the dashboard feature (the integrator wires the
 * `WidgetRegistryService.registerWidgets` call) so they show up in the dashboard
 * builder's palette under the "HR" category — the same dashboard the source
 * charts belong to, and the category that matches per-member data.
 */
export const CHART_DASHBOARD_WIDGETS: WidgetRegistryConfig[] = [
	{
		location: 'dashboard',
		category: 'hr',
		widgetId: CHART_WIDGET_IDS.EMPLOYEE_STATISTICS,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.EMPLOYEE_STATISTICS_CHART.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.EMPLOYEE_STATISTICS_CHART.DESCRIPTION',
		icon: 'pie-chart-outline',
		// One row taller than its fixed-kind siblings: the chart-type dropdown
		// takes the top of the card.
		defaultSize: { w: 6, h: 5 },
		minSize: { w: 4, h: 4 },
		maxSize: CHART_MAX_SIZE,
		supportedWidths: CHART_SUPPORTED_WIDTHS,
		contextRequirements: CHART_CONTEXT,
		permissions: CHART_PERMISSIONS,
		configSchema: [
			{
				key: EMPLOYEE_CHART_TYPE_CONFIG_KEY,
				label: 'DASHBOARD_PAGE.CHARTS.CHART_TYPE',
				type: 'select',
				options: EMPLOYEE_CHART_KINDS.map((kind: EmployeeChartKind) => ({
					label: EMPLOYEE_CHART_KIND_LABELS[kind],
					value: kind
				})),
				default: EmployeeChartKind.HORIZONTAL_BAR
			}
		],
		loadComponent: () =>
			import('./employee-statistics-chart-widget.component').then((m) => m.EmployeeStatisticsChartWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'hr',
		widgetId: CHART_WIDGET_IDS.EMPLOYEE_HORIZONTAL_BAR,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.EMPLOYEE_BAR_CHART.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.EMPLOYEE_BAR_CHART.DESCRIPTION',
		icon: 'bar-chart-outline',
		defaultSize: CHART_DEFAULT_SIZE,
		minSize: CHART_MIN_SIZE,
		maxSize: CHART_MAX_SIZE,
		supportedWidths: CHART_SUPPORTED_WIDTHS,
		contextRequirements: CHART_CONTEXT,
		permissions: CHART_PERMISSIONS,
		loadComponent: () =>
			import('./employee-horizontal-bar-chart-widget.component').then(
				(m) => m.EmployeeHorizontalBarChartWidgetComponent
			)
	},
	{
		location: 'dashboard',
		category: 'hr',
		widgetId: CHART_WIDGET_IDS.EMPLOYEE_DOUGHNUT,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.EMPLOYEE_DOUGHNUT_CHART.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.EMPLOYEE_DOUGHNUT_CHART.DESCRIPTION',
		icon: 'pie-chart-2-outline',
		// A doughnut is square-ish, so it reads well in a narrower cell than the
		// bar charts do.
		defaultSize: { w: 4, h: 4 },
		minSize: CHART_MIN_SIZE,
		maxSize: CHART_MAX_SIZE,
		supportedWidths: CHART_SUPPORTED_WIDTHS,
		contextRequirements: CHART_CONTEXT,
		permissions: CHART_PERMISSIONS,
		loadComponent: () =>
			import('./employee-doughnut-chart-widget.component').then((m) => m.EmployeeDoughnutChartWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'hr',
		widgetId: CHART_WIDGET_IDS.EMPLOYEE_STACKED_BAR,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.EMPLOYEE_STACKED_BAR_CHART.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.EMPLOYEE_STACKED_BAR_CHART.DESCRIPTION',
		icon: 'layers-outline',
		defaultSize: CHART_DEFAULT_SIZE,
		minSize: CHART_MIN_SIZE,
		maxSize: CHART_MAX_SIZE,
		supportedWidths: CHART_SUPPORTED_WIDTHS,
		contextRequirements: CHART_CONTEXT,
		permissions: CHART_PERMISSIONS,
		loadComponent: () =>
			import('./employee-stacked-bar-chart-widget.component').then(
				(m) => m.EmployeeStackedBarChartWidgetComponent
			)
	}
];
