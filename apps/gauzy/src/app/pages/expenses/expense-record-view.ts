import { Injector } from '@angular/core';
import { BaseEntityEnum, ExpenseStatusesEnum, IExpense, PermissionsEnum } from '@gauzy/contracts';
import { employeeMapper } from '@gauzy/ui-core/common';
import { ExpensesService } from '@gauzy/ui-core/core';
import { IRecordViewRouteData, IRecordViewSection } from '@gauzy/ui-core/shared';

/** Relations an expense's View reads — the same the expenses grid loads. */
export const EXPENSE_VIEW_RELATIONS = [
	'employee',
	'employee.user',
	'category',
	'vendor',
	'tags',
	'project',
	'organizationContact'
];

/** The status badge of the expenses grid: paid green, invoiced amber, otherwise red. */
export function expenseStatusBadge(value: ExpenseStatusesEnum | string): { text: string; class: string | null } {
	const badgeClass =
		value === ExpenseStatusesEnum.PAID ? 'success' : value === ExpenseStatusesEnum.INVOICED ? 'warning' : 'danger';
	return { text: String(value ?? '').replace(/_/g, ' '), class: badgeClass };
}

/**
 * An expense, described for `ngx-record-view` — the grid columns read vertically. Shared by the expenses
 * drawer (a quick look) and the expense's full-width page (`/pages/accounting/expenses/view/:id`).
 */
export function buildExpenseViewSections(): IRecordViewSection[] {
	return [
		{
			fields: [
				{ label: 'SM_TABLE.DATE', key: 'valueDate', type: 'date' },
				{ label: 'SM_TABLE.VALUE', key: 'amount', type: 'money' },
				// `statuses` is the `{ text, class }` badge the grid derives when the rows are loaded.
				{ label: 'SM_TABLE.STATUS', key: 'statuses', type: 'badge' },
				{ label: 'SM_TABLE.VENDOR', key: 'vendor.name' },
				{ label: 'SM_TABLE.CATEGORY', key: 'category.name' },
				{ label: 'SM_TABLE.PROJECT', key: 'project.name' },
				{ label: 'SM_TABLE.CONTACT', key: 'organizationContact.name' },
				{
					label: 'SM_TABLE.EMPLOYEE',
					key: 'employee',
					type: 'person',
					// Same rule the grid applies: without this permission the
					// employee column is removed, so the View must not show it either.
					permission: PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				},
				{ label: 'EXPENSES_PAGE.SPLIT_EXPENSE', key: 'splitExpense', type: 'boolean' }
			]
		},
		{
			fields: [
				{ label: 'POP_UPS.PURPOSE', key: 'purpose', type: 'multiline', wide: true },
				{ label: 'SM_TABLE.NOTES', key: 'notes', type: 'multiline', wide: true },
				{ label: 'SM_TABLE.TAGS', key: 'tags', type: 'tags', wide: true }
			]
		}
	];
}

/** `/pages/accounting/expenses/view/:id` — one expense, full width (what an expense favorite opens). */
export const EXPENSE_RECORD_VIEW: IRecordViewRouteData<IExpense> = {
	heading: 'EXPENSES_PAGE.EXPENSES',
	backLink: '/pages/accounting/expenses',
	load: async (id: string, injector: Injector) => {
		const { items } = await injector.get(ExpensesService).getAll(EXPENSE_VIEW_RELATIONS, { id } as any);
		const expense = items?.[0];
		return expense
			? ({
					...expense,
					statuses: expenseStatusBadge(expense.status),
					employee: { ...employeeMapper(expense) }
				} as any)
			: null;
	},
	sections: () => buildExpenseViewSections(),
	subtitle: (expense) => expense.vendor?.name || expense.category?.name,
	favorite: { entity: BaseEntityEnum.Expense, name: (expense) => expense.vendor?.name || expense.category?.name }
};
