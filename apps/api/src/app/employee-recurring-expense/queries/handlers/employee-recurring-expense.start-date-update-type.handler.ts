import { IStartUpdateTypeInfo } from '@gauzy/models';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FindRecurringExpenseStartDateUpdateTypeHandler } from '../../../shared/handlers/recurring-expense.find-update-type.handler';
import { EmployeeRecurringExpense } from '../../employee-recurring-expense.entity';
import { EmployeeRecurringExpenseService } from '../../employee-recurring-expense.service';
import { EmployeeRecurringExpenseStartDateUpdateTypeQuery } from '../employee-recurring-expense.update-type.query';

@QueryHandler(EmployeeRecurringExpenseStartDateUpdateTypeQuery)
export class EmployeeRecurringExpenseUpdateTypeHandler
	extends FindRecurringExpenseStartDateUpdateTypeHandler<
		EmployeeRecurringExpense
	>
	implements IQueryHandler<EmployeeRecurringExpenseStartDateUpdateTypeQuery> {
	constructor(
		private readonly employeeRecurringExpenseService: EmployeeRecurringExpenseService
	) {
		super(employeeRecurringExpenseService);
	}

	public async execute(
		command: EmployeeRecurringExpenseStartDateUpdateTypeQuery
	): Promise<IStartUpdateTypeInfo> {
		return await this.executeQuery(command.input);
	}
}
