import { Injector } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import {
	IEmployeeRecurringExpense,
	IOrganizationRecurringExpense,
	RecurringExpenseDefaultCategoriesEnum
} from '@gauzy/contracts';
import { EmployeeRecurringExpenseService, OrganizationRecurringExpenseService } from '@gauzy/ui-core/core';
import { IRecordViewRouteData, IRecordViewScope, IRecordViewSection } from '@gauzy/ui-core/shared';
import { IExpenseChartBar, IExpenseMonthShare } from '../expenses/expense-view/expense-view-charts';

/** Default categories are stored as enum keys — shown translated, exactly as the block rows do. */
export function recurringExpenseCategoryName(categoryName: string, translate: (key: string) => string): string {
	return categoryName in RecurringExpenseDefaultCategoriesEnum
		? translate(`EXPENSES_PAGE.DEFAULT_CATEGORY.${categoryName}`)
		: categoryName;
}

/**
 * An organization recurring expense, described for `ngx-record-view`. Shared by the recurring expenses
 * drawer and the record's full-width page.
 */
export function buildOrganizationRecurringExpenseViewSections(
	expense: IOrganizationRecurringExpense,
	translate: (key: string) => string
): IRecordViewSection[] {
	return [
		{
			fields: [
				{
					label: 'POP_UPS.CATEGORY_NAME',
					value: recurringExpenseCategoryName(expense.categoryName, translate)
				},
				{ label: 'POP_UPS.DATE', key: 'startDate', type: 'date' },
				{ label: 'POP_UPS.EXPENSE_VALUE', key: 'value', type: 'money' },
				{ label: 'EXPENSES_PAGE.SPLIT_EXPENSE', key: 'splitExpense', type: 'boolean' },
				{ label: 'SM_TABLE.END_DATE', key: 'endDate', type: 'date' }
			]
		}
	];
}

/**
 * An employee recurring expense, described for `ngx-record-view`. Shared by the employee recurring
 * expenses drawer and the record's full-width page.
 */
export function buildEmployeeRecurringExpenseViewSections(
	expense: IEmployeeRecurringExpense,
	translate: (key: string) => string
): IRecordViewSection[] {
	return [
		{
			fields: [
				{ label: 'POP_UPS.EMPLOYEE', key: 'employee', type: 'person' },
				{
					label: 'POP_UPS.CATEGORY_NAME',
					value: recurringExpenseCategoryName(expense.categoryName, translate)
				},
				{ label: 'POP_UPS.STARTS_ON', key: 'startDate', type: 'date' },
				{ label: 'POP_UPS.EXPENSE_VALUE', key: 'value', type: 'money' },
				{ label: 'SM_TABLE.END_DATE', key: 'endDate', type: 'date' }
			]
		}
	];
}

const translatorOf = (injector: Injector) => {
	const translateService = injector.get(TranslateService);
	return (key: string) => translateService.instant(key);
};

/** Where the organization recurring expense page's back button leads, and where a deleted one's page goes. */
export const ORGANIZATION_RECURRING_EXPENSES_LIST_LINK = '/pages/accounting/expense-recurring';

/** Reads one organization recurring expense of the organization in `scope`; `null` when there is none. */
export async function loadOrganizationRecurringExpense(
	service: OrganizationRecurringExpenseService,
	id: string,
	scope: IRecordViewScope
): Promise<IOrganizationRecurringExpense | null> {
	const { items } = await service.getAll([], {
		id,
		organizationId: scope.organizationId,
		tenantId: scope.tenantId
	} as any);
	return items?.find((item) => item.id === id) ?? null;
}

/**
 * Every period of the same recurring expense, oldest first: an edit that changes the amount from a later month
 * ends the period and starts a new one, both sharing the first period's id as their parent.
 */
export async function loadOrganizationRecurringExpensePeriods(
	service: OrganizationRecurringExpenseService,
	expense: IOrganizationRecurringExpense,
	scope: IRecordViewScope
): Promise<IOrganizationRecurringExpense[]> {
	if (!expense.parentRecurringExpenseId) {
		return [expense];
	}
	const { items = [] } = await service.getAll(
		[],
		{
			parentRecurringExpenseId: expense.parentRecurringExpenseId,
			organizationId: scope.organizationId,
			tenantId: scope.tenantId
		} as any,
		{ startDate: 'ASC' }
	);
	return items.length ? items : [expense];
}

/** Where a recurring expense stands today. */
export type RecurringExpenseState = 'active' | 'upcoming' | 'ended';

export function recurringExpenseStateOf(
	expense: Pick<IOrganizationRecurringExpense, 'startDate' | 'endDate'>,
	today: Date = new Date()
): RecurringExpenseState {
	if (expense.startDate && moment(today).isBefore(expense.startDate, 'day')) {
		return 'upcoming';
	}
	if (expense.endDate && moment(today).isAfter(expense.endDate, 'day')) {
		return 'ended';
	}
	return 'active';
}

/** The fields a recurring expense's months are read from. */
type RecurringExpenseMonths = Pick<
	IOrganizationRecurringExpense,
	'startDate' | 'endDate' | 'startYear' | 'startMonth' | 'endYear' | 'endMonth'
>;

const isSet = (value: unknown): boolean => value !== null && value !== undefined && value !== '';

/**
 * A month the expense is stored with (`startYear`/`startMonth`, or the end pair): the month the list shows and the
 * API edits and deletes by, 0-based as JavaScript counts months, as the API and the form store it. Its date is an
 * instant, which reads as the month before west of the time zone it was saved in (a period the API starts on the 1st
 * at 00:00 UTC is the 31st of the month before in New York). So the stored month wins when it is the date's month
 * here, or when the date is the stored month's first day in some time zone (UTC-12 to UTC+14). A stored month that
 * is neither is not trusted, and the date is read instead: the random seed stores `startMonth` one-based
 * (`getMonth() + 1`), on a date anywhere in the month.
 */
function storedMonth(year: unknown, month: unknown, date: Date | string | null | undefined): moment.Moment | null {
	const stored = isSet(year) && isSet(month) ? moment([Number(year), Number(month), 1]) : null;
	if (!date) {
		return stored;
	}
	const local = moment(date).startOf('month');
	if (!stored || stored.isSame(local, 'month')) {
		return stored ?? local;
	}
	const hour = 60 * 60 * 1000;
	const firstDayUtc = Date.UTC(stored.year(), stored.month(), 1);
	const at = new Date(date).getTime();
	return at >= firstDayUtc - 14 * hour && at <= firstDayUtc + 12 * hour ? stored : local;
}

/** The expense's first month ({@link storedMonth}); `null` when it has none. */
export function recurringExpenseStartMonth(expense: RecurringExpenseMonths): moment.Moment | null {
	return storedMonth(expense.startYear, expense.startMonth, expense.startDate);
}

/** The expense's last month, read as its first month is; `null` when it has no end. */
export function recurringExpenseEndMonth(expense: RecurringExpenseMonths): moment.Moment | null {
	return storedMonth(expense.endYear, expense.endMonth, expense.endDate);
}

/**
 * How many months the expense has been charged for up to `today`: its start month through the current month, or
 * through its end month once it has ended. None before its start day, as its state reads it upcoming.
 */
export function recurringExpenseMonthsCharged(expense: RecurringExpenseMonths, today: Date = new Date()): number {
	const start = recurringExpenseStartMonth(expense);
	// Nothing is charged before the expense starts — even within its first month, before its first day.
	if (!start || (expense.startDate && moment(today).isBefore(expense.startDate, 'day'))) {
		return 0;
	}
	const now = moment(today).startOf('month');
	const end = recurringExpenseEndMonth(expense);
	const last = end ? moment.min(end, now) : now;
	const months = last.diff(start, 'months') + 1;
	return months > 0 ? months : 0;
}

/**
 * The month the page is about: today's month, kept within the expense's own months — its first month before it
 * starts, its last once it has ended. The month the charts end on, and the "this month" of the delete dialog.
 */
export function recurringExpenseFocusMonth(expense: RecurringExpenseMonths, today: Date = new Date()): moment.Moment {
	const month = moment(today).startOf('month');
	const start = recurringExpenseStartMonth(expense);
	if (start && month.isBefore(start)) {
		return start;
	}
	const end = recurringExpenseEndMonth(expense);
	if (end && month.isAfter(end)) {
		return end;
	}
	return month;
}

/** The spans the monthly cost chart's range filter offers, in months, and the one it opens with. */
export const RECURRING_COST_CHART_MONTH_OPTIONS = [6, 12, 24];
export const RECURRING_COST_CHART_MONTHS = 12;

/**
 * The monthly cost chart's bars: the `months` months ending with the focus month, each the amount the expense
 * charged that month — the period that covers it, none when no period does. The months of the page's own period
 * are highlighted.
 */
export function recurringExpenseMonthBars(
	periods: IOrganizationRecurringExpense[],
	current: IOrganizationRecurringExpense,
	months: number,
	locale = 'en',
	today: Date = new Date()
): IExpenseChartBar[] {
	const last = recurringExpenseFocusMonth(current, today);
	const covers = (period: IOrganizationRecurringExpense, month: moment.Moment) => {
		const start = recurringExpenseStartMonth(period);
		const end = recurringExpenseEndMonth(period);
		return !!start && !start.isAfter(month) && (!end || !end.isBefore(month));
	};
	const bars: IExpenseChartBar[] = [];
	for (let i = months - 1; i >= 0; i--) {
		const month = last.clone().subtract(i, 'months').locale(locale);
		const period = periods.find((candidate) => covers(candidate, month));
		bars.push({
			label: month.format('MMM'),
			title: month.format('MMMM YYYY'),
			value: period ? Number(period.value) || 0 : 0,
			highlight: covers(current, month)
		});
	}
	return bars;
}

/**
 * The expense against the organization's other recurring expenses in the same month, in its currency: the rows
 * the month's read answers, which include the expense itself. None when the month has nothing to compare.
 */
export function recurringExpenseMonthShare(
	expense: IOrganizationRecurringExpense,
	monthExpenses: IOrganizationRecurringExpense[]
): IExpenseMonthShare | null {
	const sameCurrency = monthExpenses.filter((item) => !item.currency || !expense.currency || item.currency === expense.currency);
	const amount = Number(expense.value) || 0;
	const others = sameCurrency
		.filter((item) => item.id !== expense.id)
		.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
	const total = amount + others;
	if (total <= 0) {
		return null;
	}
	return { amount, rest: others, total, percent: Math.round((amount / total) * 1000) / 10 };
}

/** `/pages/employees/recurring-expenses/view/:id` — one employee recurring expense, full width. */
export const EMPLOYEE_RECURRING_EXPENSE_RECORD_VIEW: IRecordViewRouteData<IEmployeeRecurringExpense> = {
	heading: 'EMPLOYEES_PAGE.RECURRING_EXPENSE',
	backLink: '/pages/employees/recurring-expenses',
	load: async (id: string, injector: Injector, scope: IRecordViewScope) => {
		const { items } = await injector.get(EmployeeRecurringExpenseService).getAll(
			['employee', 'employee.user'],
			{
				id,
				organizationId: scope.organizationId,
				tenantId: scope.tenantId
			} as any,
			// The read requires an order: without one the service sends `order=undefined`, which the API
			// answers with a 500 (found in the browser check).
			{ startDate: 'ASC' } as any
		);
		return items?.find((item) => item.id === id) ?? null;
	},
	sections: (expense, injector) => buildEmployeeRecurringExpenseViewSections(expense, translatorOf(injector)),
	subtitle: (expense) => (expense.employee as any)?.user?.name ?? (expense.employee as any)?.fullName
};
