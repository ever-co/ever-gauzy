import { RecurringExpenseByMonthFindInput } from '@gauzy/models';
import { IsNull, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

import { CrudService, IPagination } from '../../core';
import { OrganizationRecurringExpense } from '../../organization-recurring-expense';
import { EmployeeRecurringExpense } from '../../employee-recurring-expense';

/**
 * Finds income, expense, profit and bonus for all organizations for the given month.
 *
 * (start date) < (input date) < (end date, null for end date is treated as infinity)
 *
 * If year is different, only company year.
 * If year is same, compare month
 */
export abstract class FindRecurringExpenseByMonthHandler {
	//TODO: Change CrudService<any> to be more specific
	constructor(
		private readonly crudService: CrudService<
			OrganizationRecurringExpense | EmployeeRecurringExpense
		>
	) {}

	public async executeCommand(
		input: RecurringExpenseByMonthFindInput | any
	): Promise<
		IPagination<OrganizationRecurringExpense | EmployeeRecurringExpense>
	> {
		const inputStartDate = new Date(input.year, input.month - 1, 1);

		const whereId = input.orgId
			? {
					orgId: input.orgId
			  }
			: {
					employeeId: input.employeeId
			  };

		const expenses = await this.crudService.findAll({
			where: [
				{
					...whereId,
					startDate: LessThanOrEqual(inputStartDate),
					endDate: IsNull()
				},
				{
					...whereId,
					startDate: LessThanOrEqual(inputStartDate),
					endDate: MoreThanOrEqual(inputStartDate)
				}
			]
		});

		return expenses;
	}
}
