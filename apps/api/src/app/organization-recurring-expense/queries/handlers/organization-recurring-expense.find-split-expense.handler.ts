import { OrganizationRecurringExpenseForEmployeeOutput } from '@gauzy/models';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IPagination } from '../../../core';
import { EmployeeService } from '../../../employee';
import { OrganizationService } from '../../../organization';
import { OrganizationRecurringExpenseService } from '../../organization-recurring-expense.service';
import { OrganizationRecurringExpenseFindSplitExpenseQuery } from '../organization-recurring-expense.find-split-expense.query';

/**
 * Finds the split recurring expense for a given organization.
 *
 * 1. Find all recurring expenses for the organization which have splitExpense = true
 * 2. Find all employees of the organization (TODO: No. of employees CURRENTLY in the organization?)
 * 3. Divide the value of the expense found in 1 to the no. of employees found in 2 to 'split' the expense equally for all employees.
 */
@QueryHandler(OrganizationRecurringExpenseFindSplitExpenseQuery)
export class OrganizationRecurringExpenseFindSplitExpenseHandler
	implements
		IQueryHandler<OrganizationRecurringExpenseFindSplitExpenseQuery> {
	constructor(
		private readonly organizationRecurringExpenseService: OrganizationRecurringExpenseService,
		private readonly organizationService: OrganizationService,
		private readonly employeeService: EmployeeService
	) {}

	public async execute(
		query: OrganizationRecurringExpenseFindSplitExpenseQuery
	): Promise<IPagination<OrganizationRecurringExpenseForEmployeeOutput>> {
		const { orgId, findInput } = query;

		//1. Find all recurring expenses for the organization which have splitExpense = true
		const {
			items,
			total
		} = await this.organizationRecurringExpenseService.findAll({
			where: { ...findInput, splitExpense: true, orgId }
		});

		const organization = await this.organizationService.findOne({
			id: orgId
		});

		//2. Find all employees of the organization
		const orgEmployees = await this.employeeService.findAll({
			where: {
				organization
			}
		});

		//3. Divide the value of the expense found in 1 to the no. of employees found in 2 to 'split' the expense equally for all employees.
		const splitItems = items.map((e) => ({
			...e,
			value: +(
				e.value / (orgEmployees.total !== 0 ? orgEmployees.total : 1)
			).toFixed(2),
			originalValue: +e.value,
			employeeCount: orgEmployees.total
		}));

		return { items: splitItems, total };
	}
}
