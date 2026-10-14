import { Injector } from '@angular/core';
import { BaseEntityEnum, IIncome, PermissionsEnum } from '@gauzy/contracts';
import { employeeMapper } from '@gauzy/ui-core/common';
import { IncomeService } from '@gauzy/ui-core/core';
import { IRecordViewRouteData, IRecordViewScope, IRecordViewSection } from '@gauzy/ui-core/shared';

/** Relations an income's View reads — the same the income grid loads. */
export const INCOME_VIEW_RELATIONS = ['employee', 'employee.user', 'tags', 'organization', 'client'];

/**
 * An income, described for `ngx-record-view` — the grid columns read vertically. Shared by the income
 * drawer (a quick look) and the income's full-width page (`/pages/accounting/income/view/:id`).
 */
export function buildIncomeViewSections(): IRecordViewSection[] {
	return [
		{
			fields: [
				{ label: 'SM_TABLE.DATE', key: 'valueDate', type: 'date' },
				{ label: 'SM_TABLE.VALUE', key: 'amount', type: 'money' },
				{ label: 'SM_TABLE.BONUS', key: 'isBonus', type: 'boolean' },
				{ label: 'SM_TABLE.CONTACT', key: 'client.name' },
				{
					label: 'SM_TABLE.EMPLOYEE',
					key: 'employee',
					type: 'person',
					// Same rule the grid applies: without this permission the
					// employee column is removed, so the View must not show it either.
					permission: PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				}
			]
		},
		{
			fields: [
				{ label: 'SM_TABLE.NOTES', key: 'notes', type: 'multiline', wide: true },
				{ label: 'SM_TABLE.TAGS', key: 'tags', type: 'tags', wide: true }
			]
		}
	];
}

/** `/pages/accounting/income/view/:id` — one income, full width (what an income favorite opens). */
export const INCOME_RECORD_VIEW: IRecordViewRouteData<IIncome> = {
	heading: 'INCOME_PAGE.INCOME',
	backLink: '/pages/accounting/income',
	load: async (id: string, injector: Injector, scope: IRecordViewScope) => {
		const { items } = await injector.get(IncomeService).getAll(INCOME_VIEW_RELATIONS, {
			id,
			organizationId: scope.organizationId,
			tenantId: scope.tenantId
		} as any);
		const income = items?.find((item) => item.id === id);
		return income ? ({ ...income, employee: { ...employeeMapper(income) } } as any) : null;
	},
	sections: () => buildIncomeViewSections(),
	subtitle: (income) => income.client?.name,
	favorite: { entity: BaseEntityEnum.Income, name: (income) => income.client?.name }
};
