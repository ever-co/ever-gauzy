import { SplitExpenseOutput } from '@gauzy/models';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IPagination } from '../../../core';
import { EmployeeService } from '../../../employee';
import { OrganizationService } from '../../../organization';
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
		private readonly employeeService: EmployeeService,
		private readonly organizationService: OrganizationService
	) {}

	public async execute(
		query: FindSplitExpenseQuery
	): Promise<IPagination<SplitExpenseOutput>> {
		const {
			findInput: { relations, filterDate, employeeId }
		} = query;

		const employee = await this.employeeService.findOne({
			where: {
				id: employeeId
			},
			relations: ['organization']
		});

		//1. Find all expenses for organization which have splitExpense = true & all for the employee
		const { items, total } = await this.expenseService.findAll(
			{
				where: [
					{
						organization: employee.organization,
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
				organization: employee.organization
			}
		});

		console.log(items, total);

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
