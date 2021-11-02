import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IncomeCreateCommand } from '../income.create.command';
import { IncomeService } from '../../income.service';
import { Income } from '../../income.entity';
import { EmployeeService } from '../../../employee/employee.service';
import { OrganizationService } from '../../../organization/organization.service';
import { EmployeeStatisticsService } from '../../../employee-statistics';
import { RequestContext } from '../../../core/context';

@CommandHandler(IncomeCreateCommand)
export class IncomeCreateHandler
	implements ICommandHandler<IncomeCreateCommand> {
	constructor(
		private readonly incomeService: IncomeService,
		private readonly employeeService: EmployeeService,
		private readonly organizationService: OrganizationService,
		private readonly employeeStatisticsService: EmployeeStatisticsService
	) {}

	public async execute(command: IncomeCreateCommand): Promise<Income> {
		const income = await this.createIncome(command);
		let averageIncome = 0;
		let averageBonus = 0;
		if (income && income.employeeId) {
			const id = income.employeeId;
			const stat = await this.employeeStatisticsService.getStatisticsByEmployeeId(
				income.employeeId
			);
			averageIncome = this.incomeService.countStatistic(
				stat.incomeStatistics
			);
			averageBonus = this.incomeService.countStatistic(
				stat.bonusStatistics
			);
			await this.employeeService.create({
				id,
				averageIncome: averageIncome,
				averageBonus: averageBonus
			});
		}
		return income;
	}

	public async createIncome(command: IncomeCreateCommand): Promise<Income> {
		const { input } = command;

		const income = new Income();
		const employee = input.employeeId
			? await this.employeeService.findOneByIdString(input.employeeId)
			: null;
		const organization = await this.organizationService.findOneByIdString(
			input.organizationId
		);

		income.clientId = input.clientId;
		income.employee = employee;
		income.organization = organization;
		income.amount = input.amount;
		income.valueDate = input.valueDate;
		income.notes = input.notes;
		income.currency = input.currency;
		income.isBonus = input.isBonus;
		income.reference = input.reference;
		income.tags = input.tags;
		income.tenantId = RequestContext.currentTenantId();

		if (!income.currency) {
			income.currency = organization.currency;
		}

		return await this.incomeService.create(income);
	}
}
