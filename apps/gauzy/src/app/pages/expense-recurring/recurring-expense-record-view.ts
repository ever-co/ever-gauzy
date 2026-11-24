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
