import { ID, IMonthAggregatedEmployeeStatistics, IMonthAggregatedEmployeeStatisticsFindInput } from '@gauzy/contracts';
import { toUTC } from '@gauzy/ui-core/common';
// Type-only import: keeps this module free of a runtime dependency on
// `@gauzy/ui-core/core`, so it stays trivially unit-testable.
import type { IDashboardWidgetContext } from '@gauzy/ui-core/core';

/** Date format the `/employee-statistics/months` endpoint expects. */
const API_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

/**
 * Theme tokens standing in for the hard-coded hexes of the legacy Human
 * Resources page (`#089c17`, `#dbc300`, `#66de0b`, `#ff7b00`).
 *
 * `ga-info-block` applies these through `[style.color]`, so they have to be
 * CSS values rather than SCSS functions — Nebular publishes every palette entry
 * as a custom property, which is what keeps the blocks readable in all eight
 * themes instead of only the light one the hexes were picked for.
 */
export const HR_BLOCK_COLORS = {
	/** Money coming in. */
	INCOME: 'var(--color-success-default)',
	/** Money going out. */
	EXPENSE: 'var(--color-warning-default)',
	/** Bonus figures. */
	BONUS: 'var(--color-success-default)',
	/** Any figure that turned negative (loss, clawed-back bonus). */
	NEGATIVE: 'var(--color-danger-default)'
} as const;

/**
 * Every aggregate the Human Resources dashboard derives from one
 * `/employee-statistics/months` response.
 *
 * Field-for-field the same set `HumanResourcesComponent.getEmployeeStatistics()`
 * computes, so a widget and the legacy page can never disagree on a number.
 */
export interface IHrStatisticsTotals {
	/** All income, bonus income included. */
	income: number;
	/** Income excluding the direct income bonus. */
	nonBonusIncome: number;
	/** All expenses, salary included. */
	expense: number;
	/** Expenses excluding salary. */
	expenseWithoutSalary: number;
	/** Salary, i.e. the difference between the two expense figures. */
	salary: number;
	/** Income minus expenses. */
	profit: number;
	/** Total bonus, direct income bonus included. */
	bonus: number;
	/** Bonus that came straight from income. */
	directIncomeBonus: number;
	/** Bonus computed from the organization's bonus rule (total minus direct). */
	calculatedBonus: number;
}

/** All-zero totals, shared so the identity stays stable across change detection. */
export const EMPTY_HR_TOTALS: IHrStatisticsTotals = Object.freeze({
	income: 0,
	nonBonusIncome: 0,
	expense: 0,
	expenseWithoutSalary: 0,
	salary: 0,
	profit: 0,
	bonus: 0,
	directIncomeBonus: 0,
	calculatedBonus: 0
});

/**
 * Rounds to the 2 decimals the legacy page rounds to.
 *
 * @param value - The raw sum.
 * @returns The value rounded to cents.
 */
function round(value: number): number {
	return Number(value.toFixed(2));
}

/**
 * Sums one numeric column of the monthly statistics rows.
 *
 * Coerces every cell with `Number(...) || 0` instead of the legacy page's bare
 * `a + b[key]`: a single missing or `null` cell there poisons the whole sum into
 * `NaN`, which renders as an empty widget with no error to explain it.
 *
 * @param rows - Monthly statistics rows.
 * @param key - Column to add up.
 * @returns The rounded sum.
 */
function sumField(rows: IMonthAggregatedEmployeeStatistics[], key: keyof IMonthAggregatedEmployeeStatistics): number {
	const total = rows.reduce(
		(sum: number, row: IMonthAggregatedEmployeeStatistics) => sum + (Number(row?.[key]) || 0),
		0
	);
	return round(total);
}

/**
 * Reduces the monthly statistics rows to the aggregates the widgets render.
 *
 * Mirrors `HumanResourcesComponent.getEmployeeStatistics()` one for one.
 *
 * @param rows - Monthly statistics rows, or `null` before the first fetch.
 * @returns The derived totals; all zeros when there is nothing to sum.
 */
export function sumHrStatistics(rows: IMonthAggregatedEmployeeStatistics[] | null | undefined): IHrStatisticsTotals {
	if (!Array.isArray(rows) || rows.length === 0) {
		return EMPTY_HR_TOTALS;
	}

	const income = sumField(rows, 'income');
	const expense = sumField(rows, 'expense');
	const expenseWithoutSalary = sumField(rows, 'expenseWithoutSalary');
	const directIncomeBonus = sumField(rows, 'directIncomeBonus');
	const bonus = sumField(rows, 'bonus');

	return {
		income,
		nonBonusIncome: round(income - directIncomeBonus),
		expense,
		expenseWithoutSalary,
		salary: round(expense - expenseWithoutSalary),
		profit: sumField(rows, 'profit'),
		bonus,
		directIncomeBonus,
		calculatedBonus: round(bonus - directIncomeBonus)
	};
}

/**
 * Resolves the single employee the Human Resources figures are about.
 *
 * The placement's own scope wins over the page selector, which is what lets the
 * same widget be dropped twice on one canvas and pinned to two different people.
 * `employeeIds` may legitimately hold a `null` (the "All Employees" selection
 * carries a null id), so entries are filtered rather than indexed blindly.
 *
 * @param context - The ambient dashboard widget context.
 * @returns The employee id, or `null` when the widget has no employee in scope.
 */
export function resolveHrEmployeeId(context: IDashboardWidgetContext | null | undefined): ID | null {
	if (!context) {
		return null;
	}
	const scoped = (context.employeeIds ?? []).find((id: ID) => !!id);
	return scoped ?? context.selectedEmployee?.id ?? null;
}

/**
 * Builds the `/employee-statistics/months` request for a dashboard context.
 *
 * Parity-critical: reproduces `HumanResourcesComponent.getEmployeeStatistics()`
 * exactly — same `toUTC` shift and the same `YYYY-MM-DD HH:mm:ss` serialization —
 * so a canvas widget and the legacy page send byte-identical requests.
 *
 * @param context - The ambient dashboard widget context.
 * @param employeeId - The employee to report on.
 * @returns The request payload.
 */
export function buildHrStatisticsRequest(
	context: IDashboardWidgetContext,
	employeeId: ID
): IMonthAggregatedEmployeeStatisticsFindInput {
	return {
		employeeId,
		startDate: toUTC(context.startDate).format(API_DATE_FORMAT),
		endDate: toUTC(context.endDate).format(API_DATE_FORMAT),
		organizationId: context.organizationId,
		tenantId: context.tenantId
	};
}

/**
 * Fingerprint of everything the statistics request is built from.
 *
 * Used as the `distinctUntilChanged` comparator so that context changes the
 * request does NOT depend on (project/team scope, time format, a re-emitted
 * organization object) never trigger another fetch.
 *
 * @param context - The ambient dashboard widget context.
 * @returns A stable key.
 */
export function hrStatisticsKey(context: IDashboardWidgetContext | null | undefined): string {
	if (!context) {
		return '';
	}
	return [
		context.tenantId,
		context.organizationId,
		resolveHrEmployeeId(context),
		context.startDate?.getTime(),
		context.endDate?.getTime()
	].join('|');
}

/**
 * Serializes an object into a stable string, independent of key order.
 *
 * The comparator is explicit because the default `Array.sort()` compares UTF-16
 * code units of the stringified elements, which is not a guaranteed
 * alphabetical order — and this string IS a cache key, so an unstable order
 * would produce two keys for one request, i.e. duplicate HTTP calls.
 *
 * @param value - The object to serialize.
 * @returns A deterministic string representation.
 */
export function stableStringify(value: object): string {
	const record = value as Record<string, unknown>;
	return Object.keys(record)
		.sort((a: string, b: string) => a.localeCompare(b))
		.map((key: string) => `${key}=${JSON.stringify(record[key])}`)
		.join('&');
}
