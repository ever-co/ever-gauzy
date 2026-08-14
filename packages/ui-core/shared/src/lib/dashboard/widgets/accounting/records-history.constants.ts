import { EmployeeStatisticsHistoryEnum } from '@gauzy/contracts';

/**
 * Key under which the Records History widget persists the history it shows.
 *
 * Part of the placement's `config`, so it is persisted in saved dashboards:
 * renaming it silently resets every existing widget to the default history.
 */
export const RECORDS_HISTORY_TYPE_CONFIG_KEY = 'historyType';

/**
 * The histories the Records History table can actually render, in the order the
 * Human Resources page offers them.
 *
 * `PROFIT` is deliberately absent: `RecordsHistoryComponent._populateSmartTable()`
 * has no branch for it, so it would render a table with no columns and no title.
 * The HR page never opens the dialog with it either.
 */
export const RECORDS_HISTORY_TYPES: readonly EmployeeStatisticsHistoryEnum[] = [
	EmployeeStatisticsHistoryEnum.INCOME,
	EmployeeStatisticsHistoryEnum.NON_BONUS_INCOME,
	EmployeeStatisticsHistoryEnum.BONUS_INCOME,
	EmployeeStatisticsHistoryEnum.EXPENSES,
	EmployeeStatisticsHistoryEnum.EXPENSES_WITHOUT_SALARY
] as const;

/** History shown when a placement carries no (or an unusable) configuration. */
export const DEFAULT_RECORDS_HISTORY_TYPE = EmployeeStatisticsHistoryEnum.INCOME;

/**
 * Translation keys labelling each history in the configuration dialog.
 *
 * Reuses the labels of the Human Resources blocks that open the very same
 * dialog, so the dropdown names a widget exactly like the page names the figure
 * it drills into.
 */
export const RECORDS_HISTORY_TYPE_LABELS: Readonly<Record<string, string>> = {
	[EmployeeStatisticsHistoryEnum.INCOME]: 'DASHBOARD_PAGE.DEVELOPER.TOTAL_INCOME',
	[EmployeeStatisticsHistoryEnum.NON_BONUS_INCOME]: 'INCOME_PAGE.INCOME',
	[EmployeeStatisticsHistoryEnum.BONUS_INCOME]: 'DASHBOARD_PAGE.TITLE.TOTAL_DIRECT_INCOME',
	[EmployeeStatisticsHistoryEnum.EXPENSES]: 'DASHBOARD_PAGE.DEVELOPER.TOTAL_EXPENSES',
	[EmployeeStatisticsHistoryEnum.EXPENSES_WITHOUT_SALARY]: 'DASHBOARD_PAGE.TITLE.TOTAL_EXPENSES_WITHOUT_SALARY'
};

/**
 * Narrows a persisted configuration value back to a history the table can render.
 *
 * A saved layout can carry anything — a history that was renamed since, or
 * hand-edited JSON — and feeding that straight to the table would render a
 * widget with no columns and no title, and nothing to explain why.
 *
 * @param value - The persisted value.
 * @param fallback - Used when `value` is not a renderable history.
 * @returns A history the table has a branch for.
 */
export function toRecordsHistoryType(
	value: unknown,
	fallback: EmployeeStatisticsHistoryEnum = DEFAULT_RECORDS_HISTORY_TYPE
): EmployeeStatisticsHistoryEnum {
	return RECORDS_HISTORY_TYPES.includes(value as EmployeeStatisticsHistoryEnum)
		? (value as EmployeeStatisticsHistoryEnum)
		: fallback;
}
