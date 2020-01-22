import { EmployeeRecurringExpense } from '@gauzy/models';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
	Equal,
	IsNull,
	LessThan,
	LessThanOrEqual,
	MoreThan,
	MoreThanOrEqual
} from 'typeorm';
import { IPagination } from '../../../core';
import { EmployeeRecurringExpenseService } from '../../employee-recurring-expense.service';
import { EmployeeRecurringExpenseByMonthQuery } from '../employee-recurring-expense.by-month.query';

/**
 * Finds income, expense, profit and bonus for all employees for the given month.
 *
 * (start date) < (current date) < (end date, null for end date is treated as infinity)
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

		const expenses = await this.employeeRecurringExpenseService.findAll({
			where: [
				{
					employeeId: input.employeeId,
					startYear: LessThan(input.year),
					endYear: MoreThan(input.year)
				},
				{
					employeeId: input.employeeId,
					startYear: LessThan(input.year),
					endYear: IsNull()
				},
				{
					employeeId: input.employeeId,
					startYear: LessThan(input.year),
					endMonth: MoreThanOrEqual(input.month),
					endYear: Equal(input.year)
				},
				{
					employeeId: input.employeeId,
					startMonth: LessThanOrEqual(input.month),
					startYear: Equal(input.year),
					endYear: MoreThan(input.year)
				},
				{
					employeeId: input.employeeId,
					startMonth: LessThanOrEqual(input.month),
					startYear: Equal(input.year),
					endMonth: MoreThanOrEqual(input.month),
					endYear: Equal(input.year)
				},
				{
					employeeId: input.employeeId,
					startMonth: LessThanOrEqual(input.month),
					startYear: Equal(input.year),
					endMonth: IsNull(),
					endYear: IsNull()
				}
			]
		});

		return expenses;
	}
}
