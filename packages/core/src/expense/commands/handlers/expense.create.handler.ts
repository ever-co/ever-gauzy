import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IExpense, PermissionsEnum } from '@gauzy/contracts';
import { BadRequestException } from '@nestjs/common';
import { isNotEmpty } from '@gauzy/common';
import { ExpenseCreateCommand } from '../expense.create.command';
import { Expense } from '../../expense.entity';
import { ExpenseService } from '../../expense.service';
import { EmployeeService } from '../../../employee/employee.service';
import { OrganizationService } from '../../../organization/organization.service';
import { EmployeeStatisticsService } from '../../../employee-statistics';
import { RequestContext } from '../../../core/context';

@CommandHandler(ExpenseCreateCommand)
export class ExpenseCreateHandler
	implements ICommandHandler<ExpenseCreateCommand> {
	constructor(
		private readonly expenseService: ExpenseService,
		private readonly employeeService: EmployeeService,
		private readonly organizationService: OrganizationService,
		private readonly employeeStatisticsService: EmployeeStatisticsService
	) {}

	public async execute(command: ExpenseCreateCommand): Promise<IExpense> {
		const expense = await this.createExpense(command);
		try {
			let averageExpense = 0;
			if (isNotEmpty(expense.employeeId)) {
				const { employeeId } = expense;
				const stat = await this.employeeStatisticsService.getStatisticsByEmployeeId(
					employeeId
				);
				averageExpense = this.expenseService.countStatistic(
					stat.expenseStatistics
				);
				await this.employeeService.create({
					id: employeeId,
					averageExpenses: averageExpense
				});
			}
		} catch (error) {
			throw new BadRequestException(error);
		}
		return await this.expenseService.findOneByIdString(expense.id);
	}

	public async createExpense(
		command: ExpenseCreateCommand
	): Promise<IExpense> {
		const { input } = command;
		const organization = await this.organizationService.findOneByIdString(
			input.organizationId
		);
		try {
			const expense = new Expense();
			/**
			 * If employee create self expense
			 */
			if (!RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)) {
				expense.employeeId = RequestContext.currentEmployeeId();
			} else {
				expense.employeeId = input.employeeId || null;
			}
			expense.amount = Math.abs(input.amount);
			expense.category = input.category;
			expense.vendor = input.vendor;
			expense.typeOfExpense = input.typeOfExpense;
			expense.organizationContact = input.organizationContact;
			expense.organizationContactId = input.organizationContactId;
			expense.project = input.project;
			expense.projectId = input.projectId;
			expense.notes = input.notes;
			expense.valueDate = input.valueDate;
			expense.organizationId = input.organizationId;
			expense.currency = input.currency || organization.currency;
			expense.purpose = input.purpose;
			expense.taxType = input.taxType;
			expense.taxLabel = input.taxLabel;
			expense.rateValue = input.rateValue;
			expense.receipt = input.receipt;
			expense.splitExpense = input.splitExpense;
			expense.tags = input.tags;
			expense.status = input.status;
			expense.tenantId = RequestContext.currentTenantId();
			return await this.expenseService.create(expense);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
