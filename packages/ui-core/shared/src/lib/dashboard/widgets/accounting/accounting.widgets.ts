import { PermissionsEnum } from '@gauzy/contracts';
import { WidgetRegistryConfig } from '@gauzy/ui-core/core';

/**
 * Namespaced widget ids for the Accounting KPIs.
 *
 * These strings are persisted inside every saved dashboard layout
 * (`IDashboardWidgetPlacement.widgetId`), so treat them as a public data
 * contract: renaming one orphans every placement that references it.
 */
export const ACCOUNTING_WIDGET_IDS = {
	TOTAL_INCOME: 'accounting.total-income',
	TOTAL_EXPENSES: 'accounting.total-expenses',
	PROFIT: 'accounting.profit',
	TOTAL_BONUS: 'accounting.total-bonus'
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
 * Registry entries for the four Accounting KPI widgets.
 *
 * Registered by the dashboard feature (the integrator wires the
 * `WidgetRegistryService.registerWidgets` call) so they show up in the dashboard
 * builder's palette under the "Accounting" category.
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
	}
];
