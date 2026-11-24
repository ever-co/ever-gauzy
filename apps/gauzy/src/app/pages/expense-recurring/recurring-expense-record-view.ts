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

/**
 * How many months the expense has been charged for up to `today`: its start month through the current month, or
 * through its end month once it has ended. None before it starts.
 */
export function recurringExpenseMonthsCharged(
	expense: Pick<IOrganizationRecurringExpense, 'startDate' | 'endDate'>,
	today: Date = new Date()
): number {
	if (!expense.startDate) {
		return 0;
	}
	const start = moment(expense.startDate).startOf('month');
	const now = moment(today).startOf('month');
	const last = expense.endDate ? moment.min(moment(expense.endDate).startOf('month'), now) : now;
	const months = last.diff(start, 'months') + 1;
	return months > 0 ? months : 0;
}

/**
 * The month the page is about: today's month, kept within the expense's own months — its first month before it
 * starts, its last once it has ended. The month the charts end on, and the "this month" of the delete dialog.
 */
export function recurringExpenseFocusMonth(
	expense: Pick<IOrganizationRecurringExpense, 'startDate' | 'endDate'>,
	today: Date = new Date()
): moment.Moment {
	const month = moment(today).startOf('month');
	if (expense.startDate) {
		const start = moment(expense.startDate).startOf('month');
		if (month.isBefore(start)) {
			return start;
		}
	}
	if (expense.endDate) {
		const end = moment(expense.endDate).startOf('month');
		if (month.isAfter(end)) {
			return end;
		}
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
	const covers = (period: IOrganizationRecurringExpense, month: moment.Moment) =>
		!!period.startDate &&
		!moment(period.startDate).startOf('month').isAfter(month) &&
		(!period.endDate || !moment(period.endDate).startOf('month').isBefore(month));
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
