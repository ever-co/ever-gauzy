import { EmployeeRecurringExpense } from '@gauzy/models';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IsNull, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { IPagination } from '../../../core';
import { EmployeeRecurringExpenseService } from '../../employee-recurring-expense.service';
import { EmployeeRecurringExpenseByMonthQuery } from '../employee-recurring-expense.by-month.query';

/**
 * Finds income, expense, profit and bonus for all employees for the given month.
 *
 * (start date) < (input date) < (end date, null for end date is treated as infinity)
 *
 * If year is different, only company year.
 * If year is same, compare month
 */
@QueryHandler(EmployeeRecurringExpenseByMonthQuery)
export class EmployeeRecurringExpenseByMonthHandler
	implements IQueryHandler<EmployeeRecurringExpenseByMonthQuery> {
	constructor(
		private readonly employeeRecurringExpenseService: EmployeeRecurringExpenseService
	) {}

	public async execute(
		command: EmployeeRecurringExpenseByMonthQuery
	): Promise<IPagination<EmployeeRecurringExpense>> {
		const { input } = command;

		const inputStartDate = new Date(input.year, input.month - 1, 1);
		const expenses = await this.employeeRecurringExpenseService.findAll({
			where: [
				{
					employeeId: input.employeeId,
					startDate: LessThanOrEqual(inputStartDate),
					endDate: IsNull()
				},
				{
					employeeId: input.employeeId,
					startDate: LessThanOrEqual(inputStartDate),
					endDate: MoreThanOrEqual(inputStartDate)
				}
			]
		});

		return expenses;
	}
}
