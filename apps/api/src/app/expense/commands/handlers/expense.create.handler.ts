import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ExpenseCreateCommand } from '../expense.create.command';
import { Expense } from '../../expense.entity';
import { ExpenseService } from '../../expense.service';
import { EmployeeService } from '../../../employee/employee.service';
import { OrganizationService } from '../../../organization/organization.service';

@CommandHandler(ExpenseCreateCommand)
export class ExpenseCreateHandler
	implements ICommandHandler<ExpenseCreateCommand> {
	constructor(
		private readonly expenseService: ExpenseService,
		private readonly employeeService: EmployeeService,
		private readonly organizationService: OrganizationService
	) {}

	public async execute(command: ExpenseCreateCommand): Promise<Expense> {
		const { input } = command;

		const expense = new Expense();
		const employee = input.employeeId
			? await this.employeeService.findOne(input.employeeId)
			: null;
		const organization = await this.organizationService.findOne(
			input.orgId
		);

		expense.amount = Math.abs(input.amount);
		expense.category = input.category;
		expense.vendor = input.vendor;
		expense.typeOfExpense = input.typeOfExpense;
		expense.clientName = input.clientName;
		expense.clientId = input.clientId;
		expense.projectName = input.projectName;
		expense.projectId = input.projectId;
		expense.notes = input.notes;
		expense.valueDate = input.valueDate;
		expense.employee = employee;
		expense.organization = organization;
		expense.currency = input.currency;
		expense.purpose = input.purpose;
		expense.taxType = input.taxType;
		expense.taxLabel = input.taxLabel;
		expense.rateValue = input.rateValue;
		expense.receipt = input.receipt;
		expense.splitExpense = input.splitExpense;

		if (!expense.currency) {
			expense.currency = organization.currency;
		}

		return await this.expenseService.create(expense);
	}
}
