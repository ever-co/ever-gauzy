/**
 * Dependency-free constants shared by the employee chart widgets AND their
 * registry entries.
 *
 * Split out of `employee-chart.utils.ts` on purpose: `charts.widgets.ts` is
 * reachable from the ROOT bootstrap module (through
 * `provideCoreDashboardWidgets()`), so every module it imports lands in the
 * initial bundle. The utils module pulls `@gauzy/ui-config` and the whole set of
 * Chart.js dataset builders along with it; this file pulls nothing at all, which
 * is what keeps the registry chunk to plain configuration.
 */

/**
 * The three renderings of the monthly employee statistics offered by the legacy
 * `<ga-employee-charts>` switcher on the HR dashboard.
 *
 * The string values are persisted inside a placement's `config` (the switcher
 * widget stores the user's pick under `chartType`), so treat them as a data
 * contract: renaming one resets every saved switcher to its default.
 */
export enum EmployeeChartKind {
	DOUGHNUT = 'doughnut',
	HORIZONTAL_BAR = 'horizontal-bar',
	STACKED_BAR = 'stacked-bar'
}

/** Ordered list backing the switcher widget's dropdown. */
export const EMPLOYEE_CHART_KINDS: readonly EmployeeChartKind[] = [
	EmployeeChartKind.HORIZONTAL_BAR,
	EmployeeChartKind.DOUGHNUT,
	EmployeeChartKind.STACKED_BAR
];

/**
 * Configuration key holding the rendering a switcher placement opens on.
 *
 * Declared here rather than next to the component so the widget registry can
 * reference it without eagerly importing the component — which would defeat the
 * registry entry's own `loadComponent` lazy import.
 */
export const EMPLOYEE_CHART_TYPE_CONFIG_KEY = 'chartType';

/** Translation key of each chart kind, matching the legacy switcher's labels. */
export const EMPLOYEE_CHART_KIND_LABELS: Readonly<Record<EmployeeChartKind, string>> = {
	[EmployeeChartKind.HORIZONTAL_BAR]: 'DASHBOARD_PAGE.CHARTS.BAR',
	[EmployeeChartKind.DOUGHNUT]: 'DASHBOARD_PAGE.CHARTS.DOUGHNUT',
	[EmployeeChartKind.STACKED_BAR]: 'DASHBOARD_PAGE.CHARTS.STACKED_BAR'
};
