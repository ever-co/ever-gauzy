import { Injector } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
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

/** `/pages/accounting/expense-recurring/view/:id` — one organization recurring expense, full width. */
export const ORGANIZATION_RECURRING_EXPENSE_RECORD_VIEW: IRecordViewRouteData<IOrganizationRecurringExpense> = {
	heading: 'ORGANIZATIONS_PAGE.RECURRING_EXPENSE',
	backLink: '/pages/accounting/expense-recurring',
	load: async (id: string, injector: Injector, scope: IRecordViewScope) => {
		const { items } = await injector
			.get(OrganizationRecurringExpenseService)
			.getAll([], { id, organizationId: scope.organizationId, tenantId: scope.tenantId } as any);
		return items?.find((item) => item.id === id) ?? null;
	},
	sections: (expense, injector) => buildOrganizationRecurringExpenseViewSections(expense, translatorOf(injector)),
	subtitle: (expense, injector) => recurringExpenseCategoryName(expense.categoryName, translatorOf(injector))
};

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
