import { PermissionsEnum } from '@gauzy/contracts';
import { WidgetRegistryConfig } from '@gauzy/ui-core/core';

/**
 * Namespaced widget ids for the Human Resources info blocks.
 *
 * These strings are persisted inside every saved dashboard layout
 * (`IDashboardWidgetPlacement.widgetId`), so treat them as a public data
 * contract: renaming one orphans every placement that references it.
 */
export const HR_WIDGET_IDS = {
	TOTAL_INCOME: 'hr.total-income',
	INCOME: 'hr.income',
	DIRECT_INCOME: 'hr.direct-income',
	EXPENSES_WITHOUT_SALARY: 'hr.expenses-without-salary',
	TOTAL_EXPENSES: 'hr.total-expenses',
	PROFIT: 'hr.profit',
	TOTAL_DIRECT_BONUS: 'hr.total-direct-bonus',
	PROFIT_BONUS: 'hr.profit-bonus',
	REVENUE_BONUS: 'hr.revenue-bonus'
} as const;

/**
 * An info block is a wide row (title + explanation on the left, figure on the
 * right), so it reads best at half a 12-column canvas — never at a quarter,
 * where the explanation line wraps three times.
 */
const BLOCK_DEFAULT_SIZE = { w: 6, h: 2 };
const BLOCK_MIN_SIZE = { w: 4, h: 2 };
const BLOCK_MAX_SIZE = { w: 12, h: 4 };

/** Widths an info block still reads well at. */
const BLOCK_SUPPORTED_WIDTHS: WidgetRegistryConfig['supportedWidths'] = [4, 6, 8, 12];

/**
 * Every figure on this dashboard is about ONE employee, so an employee is a hard
 * requirement — not merely a filter that narrows the numbers. Without one the
 * widgets render their "select an employee" empty state rather than zeros.
 */
const BLOCK_CONTEXT: WidgetRegistryConfig['contextRequirements'] = ['organization', 'dateRange', 'employee'];

/**
 * Permissions gating every Human Resources widget.
 *
 * Copied verbatim from the tab that owns the source page
 * (`DashboardComponent.registerAccountingTabs()` registers `/pages/dashboard/hr`
 * with exactly these two), because `WidgetRegistryConfig.permissions` is
 * evaluated with OR semantics — adding the income/expense view permissions here
 * would WIDEN access rather than narrow it.
 */
const BLOCK_PERMISSIONS: PermissionsEnum[] = [
	PermissionsEnum.ADMIN_DASHBOARD_VIEW,
	PermissionsEnum.HUMAN_RESOURCE_DASHBOARD
];

/**
 * Registry entries for the nine Human Resources info-block widgets.
 *
 * Every block is a projection of the same `/employee-statistics/months` payload;
 * `HrStatisticsCacheService` collapses them into a single request per scope, so
 * a canvas holding all nine still issues one call.
 *
 * Registered by the integrator (via `WidgetRegistryService.registerWidgets`) so
 * they show up in the dashboard builder's palette under "Human Resources".
 */
export const HR_DASHBOARD_WIDGETS: WidgetRegistryConfig[] = [
	{
		location: 'dashboard',
		category: 'hr',
		widgetId: HR_WIDGET_IDS.TOTAL_INCOME,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.HR.TOTAL_INCOME.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.HR.TOTAL_INCOME.DESCRIPTION',
		icon: 'trending-up-outline',
		// One row taller than the rest: this is the only block that can expand into
		// an accordion, and a 2-row card would clip the breakdown.
		defaultSize: { w: 6, h: 3 },
		minSize: BLOCK_MIN_SIZE,
		maxSize: BLOCK_MAX_SIZE,
		supportedWidths: BLOCK_SUPPORTED_WIDTHS,
		contextRequirements: BLOCK_CONTEXT,
		permissions: BLOCK_PERMISSIONS,
		loadComponent: () => import('./hr-total-income-widget.component').then((m) => m.HrTotalIncomeWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'hr',
		widgetId: HR_WIDGET_IDS.INCOME,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.HR.INCOME.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.HR.INCOME.DESCRIPTION',
		icon: 'arrow-circle-up-outline',
		defaultSize: BLOCK_DEFAULT_SIZE,
		minSize: BLOCK_MIN_SIZE,
		maxSize: BLOCK_MAX_SIZE,
		supportedWidths: BLOCK_SUPPORTED_WIDTHS,
		contextRequirements: BLOCK_CONTEXT,
		permissions: BLOCK_PERMISSIONS,
		loadComponent: () => import('./hr-income-widget.component').then((m) => m.HrIncomeWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'hr',
		widgetId: HR_WIDGET_IDS.DIRECT_INCOME,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.HR.DIRECT_INCOME.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.HR.DIRECT_INCOME.DESCRIPTION',
		icon: 'plus-circle-outline',
		defaultSize: BLOCK_DEFAULT_SIZE,
		minSize: BLOCK_MIN_SIZE,
		maxSize: BLOCK_MAX_SIZE,
		supportedWidths: BLOCK_SUPPORTED_WIDTHS,
		contextRequirements: BLOCK_CONTEXT,
		permissions: BLOCK_PERMISSIONS,
		loadComponent: () => import('./hr-direct-income-widget.component').then((m) => m.HrDirectIncomeWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'hr',
		widgetId: HR_WIDGET_IDS.EXPENSES_WITHOUT_SALARY,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.HR.EXPENSES_WITHOUT_SALARY.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.HR.EXPENSES_WITHOUT_SALARY.DESCRIPTION',
		icon: 'minus-circle-outline',
		defaultSize: BLOCK_DEFAULT_SIZE,
		minSize: BLOCK_MIN_SIZE,
		maxSize: BLOCK_MAX_SIZE,
		supportedWidths: BLOCK_SUPPORTED_WIDTHS,
		contextRequirements: BLOCK_CONTEXT,
		permissions: BLOCK_PERMISSIONS,
		loadComponent: () =>
			import('./hr-expenses-without-salary-widget.component').then(
				(m) => m.HrExpensesWithoutSalaryWidgetComponent
			)
	},
	{
		location: 'dashboard',
		category: 'hr',
		widgetId: HR_WIDGET_IDS.TOTAL_EXPENSES,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.HR.TOTAL_EXPENSES.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.HR.TOTAL_EXPENSES.DESCRIPTION',
		icon: 'trending-down-outline',
		defaultSize: BLOCK_DEFAULT_SIZE,
		minSize: BLOCK_MIN_SIZE,
		maxSize: BLOCK_MAX_SIZE,
		supportedWidths: BLOCK_SUPPORTED_WIDTHS,
		contextRequirements: BLOCK_CONTEXT,
		permissions: BLOCK_PERMISSIONS,
		loadComponent: () =>
			import('./hr-total-expenses-widget.component').then((m) => m.HrTotalExpensesWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'hr',
		widgetId: HR_WIDGET_IDS.PROFIT,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.HR.PROFIT.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.HR.PROFIT.DESCRIPTION',
		icon: 'pie-chart-outline',
		defaultSize: BLOCK_DEFAULT_SIZE,
		minSize: BLOCK_MIN_SIZE,
		maxSize: BLOCK_MAX_SIZE,
		supportedWidths: BLOCK_SUPPORTED_WIDTHS,
		contextRequirements: BLOCK_CONTEXT,
		permissions: BLOCK_PERMISSIONS,
		loadComponent: () => import('./hr-profit-widget.component').then((m) => m.HrProfitWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'hr',
		widgetId: HR_WIDGET_IDS.TOTAL_DIRECT_BONUS,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.HR.TOTAL_DIRECT_BONUS.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.HR.TOTAL_DIRECT_BONUS.DESCRIPTION',
		icon: 'gift-outline',
		defaultSize: BLOCK_DEFAULT_SIZE,
		minSize: BLOCK_MIN_SIZE,
		maxSize: BLOCK_MAX_SIZE,
		supportedWidths: BLOCK_SUPPORTED_WIDTHS,
		contextRequirements: BLOCK_CONTEXT,
		permissions: BLOCK_PERMISSIONS,
		loadComponent: () =>
			import('./hr-total-direct-bonus-widget.component').then((m) => m.HrTotalDirectBonusWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'hr',
		widgetId: HR_WIDGET_IDS.PROFIT_BONUS,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.HR.PROFIT_BONUS.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.HR.PROFIT_BONUS.DESCRIPTION',
		icon: 'award-outline',
		defaultSize: BLOCK_DEFAULT_SIZE,
		minSize: BLOCK_MIN_SIZE,
		maxSize: BLOCK_MAX_SIZE,
		supportedWidths: BLOCK_SUPPORTED_WIDTHS,
		contextRequirements: BLOCK_CONTEXT,
		permissions: BLOCK_PERMISSIONS,
		loadComponent: () => import('./hr-profit-bonus-widget.component').then((m) => m.HrProfitBonusWidgetComponent)
	},
	{
		location: 'dashboard',
		category: 'hr',
		widgetId: HR_WIDGET_IDS.REVENUE_BONUS,
		title: 'DASHBOARD_PAGE.BUILDER.WIDGETS.HR.REVENUE_BONUS.TITLE',
		description: 'DASHBOARD_PAGE.BUILDER.WIDGETS.HR.REVENUE_BONUS.DESCRIPTION',
		icon: 'star-outline',
		defaultSize: BLOCK_DEFAULT_SIZE,
		minSize: BLOCK_MIN_SIZE,
		maxSize: BLOCK_MAX_SIZE,
		supportedWidths: BLOCK_SUPPORTED_WIDTHS,
		contextRequirements: BLOCK_CONTEXT,
		permissions: BLOCK_PERMISSIONS,
		loadComponent: () => import('./hr-revenue-bonus-widget.component').then((m) => m.HrRevenueBonusWidgetComponent)
	}
];
