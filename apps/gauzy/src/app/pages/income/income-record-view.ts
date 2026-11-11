import { IIncome, PermissionsEnum } from '@gauzy/contracts';
import { employeeMapper } from '@gauzy/ui-core/common';
import { IncomeService } from '@gauzy/ui-core/core';
import { IRecordViewScope, IRecordViewSection } from '@gauzy/ui-core/shared';

/** Relations an income's View reads — the same the income grid loads. */
export const INCOME_VIEW_RELATIONS = ['employee', 'employee.user', 'tags', 'organization', 'client'];

/**
 * An income, described for `ngx-record-view` — the grid columns read vertically. Used by the income drawer (a
 * quick look); the income's own page (`/pages/accounting/income/view/:id`) lays the same facts out in its columns.
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

/**
 * Reads one income with everything its page shows, within the organization selected in the header. The income
 * API's `GET /income/:id` takes no relations, so the list read filtered by id is the one that brings the client,
 * employee and tags along. The employee is mapped as the grid maps it, for the person renderer.
 */
export async function loadIncome(service: IncomeService, id: string, scope: IRecordViewScope): Promise<IIncome | null> {
	const { items } = await service.getAll(INCOME_VIEW_RELATIONS, {
		id,
		organizationId: scope.organizationId,
		tenantId: scope.tenantId
	} as any);
	const income = items?.find((item) => item.id === id);
	// The grid's person shape stands in for the employee entity: not an `IEmployee`, hence the cast via `unknown`.
	return income ? ({ ...income, employee: { ...employeeMapper(income) } } as unknown as IIncome) : null;
}
