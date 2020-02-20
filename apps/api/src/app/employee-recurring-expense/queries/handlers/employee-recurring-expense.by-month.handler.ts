import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IPagination } from '../../../core';
import { FindRecurringExpenseByMonthHandler } from '../../../shared';
import { EmployeeRecurringExpense } from '../../employee-recurring-expense.entity';
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
	extends FindRecurringExpenseByMonthHandler<EmployeeRecurringExpense>
	implements IQueryHandler<EmployeeRecurringExpenseByMonthQuery> {
	constructor(
		private readonly employeeRecurringExpenseService: EmployeeRecurringExpenseService
	) {
		super(employeeRecurringExpenseService);
	}

	public async execute(
		command: EmployeeRecurringExpenseByMonthQuery
	): Promise<IPagination<EmployeeRecurringExpense>> {
		const { input } = command;

		return await this.executeCommand(input);
	}
}
