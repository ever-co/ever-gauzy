import { IPagination, ISplitExpenseOutput } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EmployeeService } from '../../../employee/employee.service';
import { ExpenseService } from '../../expense.service';
import { FindSplitExpenseQuery } from '../expense.find-split-expense.query';

/**
 * Finds the split expense for a given organization.
 *
 * 1. Find all expenses for organization which have splitExpense = true & all for the employee
 * 2. Find all employees of the organization (TODO: No. of employees CURRENTLY in the organization?)
 * 3. Divide the value of the expense found in 1 to the no. of employees found in 2 to 'split' the expense equally for all employees.
 */
@QueryHandler(FindSplitExpenseQuery)
export class FindSplitExpenseHandler
	implements IQueryHandler<FindSplitExpenseQuery> {
	constructor(
		private readonly expenseService: ExpenseService,
		private readonly employeeService: EmployeeService
	) {}

	public async execute(
		query: FindSplitExpenseQuery
	): Promise<IPagination<ISplitExpenseOutput>> {
		const {
			findInput: { relations, filterDate, employeeId }
		} = query;

		const employee = await this.employeeService.findOneByOptions({
			where: {
				id: employeeId
			},
			relations: ['organization']
		});

		//1. Find all expenses for organization which have splitExpense = true & all for the employee
		const { items, total } = await this.expenseService.findAllExpenses(
			{
				where: [
					{
						organizationId: employee.organization.id,
						splitExpense: true
					},
					{
						employee: {
							id: employeeId
						}
					}
				],
				relations
			},
			filterDate
		);

		//2. Find all employees of the organization
		const orgEmployees = await this.employeeService.findAll({
			where: {
				organizationId: employee.organization.id
			}
		});

		//3. Divide the value of the expense found in 1 to the no. of employees found in 2.
		const splitItems = items.map((e) =>
			e.splitExpense
				? {
						...e,
						amount: +(
							e.amount /
							(orgEmployees.total !== 0 ? orgEmployees.total : 1)
						).toFixed(2),
						originalValue: +e.amount,
						employeeCount: orgEmployees.total
				  }
				: e
		);

		return { items: splitItems, total };
	}
}
