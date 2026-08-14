import { EmployeeStatisticsHistoryEnum, PermissionsEnum } from '@gauzy/contracts';
import { WidgetRegistryConfig } from '@gauzy/ui-core/core';
// The DEPENDENCY-FREE constants module, never a component or a `*.utils` file.
// This file is reachable from the root bootstrap through
// `provideCoreDashboardWidgets()`, so whatever it imports lands in the INITIAL
// bundle — which is exactly what the `loadComponent` dynamic imports below exist
// to avoid.
import {
	DEFAULT_RECORDS_HISTORY_TYPE,
	RECORDS_HISTORY_TYPES,
	RECORDS_HISTORY_TYPE_CONFIG_KEY,
	RECORDS_HISTORY_TYPE_LABELS
} from './records-history.constants';

/**
 * Namespaced widget ids for the Accounting widgets.
 *
 * These strings are persisted inside every saved dashboard layout
 * (`IDashboardWidgetPlacement.widgetId`), so treat them as a public data
 * contract: renaming one orphans every placement that references it.
 */
export const ACCOUNTING_WIDGET_IDS = {
	TOTAL_INCOME: 'accounting.total-income',
	TOTAL_EXPENSES: 'accounting.total-expenses',
	PROFIT: 'accounting.profit',
	TOTAL_BONUS: 'accounting.total-bonus',
	CASH_FLOW: 'accounting.cash-flow',
	EMPLOYEE_STATISTICS: 'accounting.employee-statistics',
	RECORDS_HISTORY: 'accounting.records-history',
	PROFIT_HISTORY: 'accounting.profit-history'
} as const;

/**
 * Every KPI is a quarter-row tile by default (12-column grid → four per row),
 * matching the Accounting page's KPI strip.
 */
const KPI_DEFAULT_SIZE = { w: 3, h: 2 };
const KPI_MIN_SIZE = { w: 3, h: 2 };
const KPI_MAX_SIZE = { w: 12, h: 4 };

/** Widths a money KPI still reads well at. */
const KPI_SUPPORTED_WIDTHS: WidgetRegistryConfig['supportedWidths'] = [3, 4, 6, 12];

/**
 * All KPIs need an organization and a date range. They need nothing else on
 * purpose: `/employee-statistics/aggregate` accepts no employee, project or team
 * scope, so declaring those requirements would promise a filtering the numbers
 * do not actually honour.
 */
const KPI_CONTEXT: WidgetRegistryConfig['contextRequirements'] = ['organization', 'dateRange'];

/**
 * Permissions of the Accounting dashboard tab, verbatim.
 *
 * The tab is registered with `[ADMIN_DASHBOARD_VIEW, ACCOUNTING_DASHBOARD]` in
 * `DashboardComponent.registerAccountingTabs()`, and both the tab registry and
 * the widget palette treat the list as "any of" — so a widget carrying the same
 * pair is visible to exactly the users who can open the page it came from.
 */
const KPI_PERMISSIONS = [PermissionsEnum.ADMIN_DASHBOARD_VIEW, PermissionsEnum.ACCOUNTING_DASHBOARD];

/**
 * A chart or a table needs room: half a 12-column canvas and four 80px rows give
 * the plot ~320px and the table ~6 rows before it starts scrolling internally.
 */
const WIDE_DEFAULT_SIZE = { w: 6, h: 4 };
const WIDE_MIN_SIZE = { w: 4, h: 3 };
const WIDE_MAX_SIZE = { w: 12, h: 12 };

/** Widths a chart or a multi-column table still reads well at. */
const WIDE_SUPPORTED_WIDTHS: WidgetRegistryConfig['supportedWidths'] = [4, 6, 8, 12];

/**
 * Permissions of the Human Resources dashboard tab, verbatim.
 *
 * The two history widgets are extracted from the dialogs the HR page opens — NOT
 * from the Accounting page — so they carry the HR tab's pair
 * (`DashboardComponent.registerAccountingTabs()` registers `/pages/dashboard/hr`
 * with exactly these two). `permissions` is evaluated with OR semantics, so
 * lending them the Accounting pair would WIDEN access to per-employee income and
 * expense records rather than narrow it.
 */
const HISTORY_PERMISSIONS = [PermissionsEnum.ADMIN_DASHBOARD_VIEW, PermissionsEnum.HUMAN_RESOURCE_DASHBOARD];

/**
 * A history is a paginated table with its own header block, so it needs more
 * vertical room than a chart: six rows fit the totals strip plus a page of rows.
 */
const HISTORY_DEFAULT_SIZE = { w: 6, h: 6 };
const HISTORY_MIN_SIZE = { w: 4, h: 4 };
const HISTORY_MAX_SIZE = { w: 12, h: 12 };

/**
 * Both history widgets are about ONE employee, so an employee is a hard
 * requirement — not merely a filter that narrows the rows. Without one they
 * render their "select an employee" state rather than an empty table.
 */
const HISTORY_CONTEXT: WidgetRegistryConfig['contextRequirements'] = ['organization', 'dateRange', 'employee'];

/**
 * Registry entries for the Accounting widgets: the four KPIs, the cash-flow
 * chart, the per-employee breakdown table, and the two employee history reports
 * that used to be reachable only as modal dialogs.
 *
 * Registered by the dashboard feature (the integrator wires the
 * `WidgetRegistryService.registerWidgets` call) so they show up in the dashboard
 * builder's palette.
 */
export const ACCOUNTING_DASHBOARD_WIDGETS: WidgetRegistryConfig[] = [
	{
		location: 'dashboard',
		category: 'accounting',
		widgetId: ACCOUNTING_WIDGET_IDS.TOTAL_INCOME,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.ACCOUNTING_TOTAL_INCOME.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.ACCOUNTING_TOTAL_INCOME.DESCRIPTION',
		icon: 'trending-up-outline',
		defaultSize: KPI_DEFAULT_SIZE,
		minSize: KPI_MIN_SIZE,
		maxSize: KPI_MAX_SIZE,
		supportedWidths: KPI_SUPPORTED_WIDTHS,
		contextRequirements: KPI_CONTEXT,
		permissions: KPI_PERMISSIONS,
		loadComponent: () => import('./total-income-widget.component').then((m) => m.TotalIncomeWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'accounting',
		widgetId: ACCOUNTING_WIDGET_IDS.TOTAL_EXPENSES,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.ACCOUNTING_TOTAL_EXPENSES.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.ACCOUNTING_TOTAL_EXPENSES.DESCRIPTION',
		icon: 'trending-down-outline',
		defaultSize: KPI_DEFAULT_SIZE,
		minSize: KPI_MIN_SIZE,
		maxSize: KPI_MAX_SIZE,
		supportedWidths: KPI_SUPPORTED_WIDTHS,
		contextRequirements: KPI_CONTEXT,
		permissions: KPI_PERMISSIONS,
		loadComponent: () => import('./total-expenses-widget.component').then((m) => m.TotalExpensesWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'accounting',
		widgetId: ACCOUNTING_WIDGET_IDS.PROFIT,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.ACCOUNTING_PROFIT.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.ACCOUNTING_PROFIT.DESCRIPTION',
		icon: 'pie-chart-outline',
		defaultSize: KPI_DEFAULT_SIZE,
		minSize: KPI_MIN_SIZE,
		maxSize: KPI_MAX_SIZE,
		supportedWidths: KPI_SUPPORTED_WIDTHS,
		contextRequirements: KPI_CONTEXT,
		permissions: KPI_PERMISSIONS,
		loadComponent: () => import('./profit-widget.component').then((m) => m.ProfitWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'accounting',
		widgetId: ACCOUNTING_WIDGET_IDS.TOTAL_BONUS,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.ACCOUNTING_TOTAL_BONUS.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.ACCOUNTING_TOTAL_BONUS.DESCRIPTION',
		icon: 'gift-outline',
		defaultSize: KPI_DEFAULT_SIZE,
		minSize: KPI_MIN_SIZE,
		maxSize: KPI_MAX_SIZE,
		supportedWidths: KPI_SUPPORTED_WIDTHS,
		contextRequirements: KPI_CONTEXT,
		permissions: KPI_PERMISSIONS,
		loadComponent: () => import('./total-bonus-widget.component').then((m) => m.TotalBonusWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'accounting',
		widgetId: ACCOUNTING_WIDGET_IDS.CASH_FLOW,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.ACCOUNTING_CASH_FLOW.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.ACCOUNTING_CASH_FLOW.DESCRIPTION',
		icon: 'activity-outline',
		defaultSize: WIDE_DEFAULT_SIZE,
		minSize: WIDE_MIN_SIZE,
		maxSize: WIDE_MAX_SIZE,
		supportedWidths: WIDE_SUPPORTED_WIDTHS,
		contextRequirements: KPI_CONTEXT,
		permissions: KPI_PERMISSIONS,
		loadComponent: () => import('./cash-flow-widget.component').then((m) => m.CashFlowWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'accounting',
		widgetId: ACCOUNTING_WIDGET_IDS.EMPLOYEE_STATISTICS,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.ACCOUNTING_EMPLOYEE_STATISTICS.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.ACCOUNTING_EMPLOYEE_STATISTICS.DESCRIPTION',
		icon: 'people-outline',
		defaultSize: WIDE_DEFAULT_SIZE,
		minSize: WIDE_MIN_SIZE,
		maxSize: WIDE_MAX_SIZE,
		supportedWidths: WIDE_SUPPORTED_WIDTHS,
		contextRequirements: KPI_CONTEXT,
		permissions: KPI_PERMISSIONS,
		loadComponent: () =>
			import('./employee-statistics-widget.component').then((m) => m.EmployeeStatisticsWidgetComponent)
	},
	{
		location: 'dashboard',
		// Grouped with the other per-employee widgets rather than with Accounting:
		// the id keeps the folder's namespace, but the palette should list this
		// beside the HR blocks it drills into — and it carries the HR permissions.
		category: 'hr',
		widgetId: ACCOUNTING_WIDGET_IDS.RECORDS_HISTORY,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.ACCOUNTING_RECORDS_HISTORY.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.ACCOUNTING_RECORDS_HISTORY.DESCRIPTION',
		icon: 'list-outline',
		defaultSize: HISTORY_DEFAULT_SIZE,
		minSize: HISTORY_MIN_SIZE,
		maxSize: HISTORY_MAX_SIZE,
		supportedWidths: WIDE_SUPPORTED_WIDTHS,
		contextRequirements: HISTORY_CONTEXT,
		permissions: HISTORY_PERMISSIONS,
		configSchema: [
			{
				key: RECORDS_HISTORY_TYPE_CONFIG_KEY,
				label: 'DASHBOARD_PAGE.BUILDER.WIDGETS.ACCOUNTING_RECORDS_HISTORY.HISTORY_TYPE',
				type: 'select',
				options: RECORDS_HISTORY_TYPES.map((type: EmployeeStatisticsHistoryEnum) => ({
					label: RECORDS_HISTORY_TYPE_LABELS[type],
					value: type
				})),
				default: DEFAULT_RECORDS_HISTORY_TYPE
			}
		],
		loadComponent: () => import('./records-history-widget.component').then((m) => m.RecordsHistoryWidgetComponent)
	},
	{
		location: 'dashboard',
		// See the Records History entry above for why this is not 'accounting'.
		category: 'hr',
		widgetId: ACCOUNTING_WIDGET_IDS.PROFIT_HISTORY,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.ACCOUNTING_PROFIT_HISTORY.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.ACCOUNTING_PROFIT_HISTORY.DESCRIPTION',
		icon: 'file-text-outline',
		defaultSize: HISTORY_DEFAULT_SIZE,
		minSize: HISTORY_MIN_SIZE,
		maxSize: HISTORY_MAX_SIZE,
		supportedWidths: WIDE_SUPPORTED_WIDTHS,
		contextRequirements: HISTORY_CONTEXT,
		permissions: HISTORY_PERMISSIONS,
		loadComponent: () => import('./profit-history-widget.component').then((m) => m.ProfitHistoryWidgetComponent)
	}
];
