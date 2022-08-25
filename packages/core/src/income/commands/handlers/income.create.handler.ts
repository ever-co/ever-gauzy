import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IIncome, PermissionsEnum } from '@gauzy/contracts';
import { BadRequestException } from '@nestjs/common';
import { isNotEmpty } from '@gauzy/common';
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

	public async execute(command: IncomeCreateCommand): Promise<IIncome> {
		const income = await this.createIncome(command);
		try {
			let averageIncome = 0;
			let averageBonus = 0;
			if (isNotEmpty(income.employeeId)) {
				const { employeeId } = income;
				const stat = await this.employeeStatisticsService.getStatisticsByEmployeeId(
					employeeId
				);
				averageIncome = this.incomeService.countStatistic(
					stat.incomeStatistics
				);
				averageBonus = this.incomeService.countStatistic(
					stat.bonusStatistics
				);
				await this.employeeService.create({
					id: employeeId,
					averageIncome: averageIncome,
					averageBonus: averageBonus
				});
			}
		} catch (error) {
			throw new BadRequestException(error);
		}
		return await this.incomeService.findOneByIdString(income.id);
	}

	public async createIncome(command: IncomeCreateCommand): Promise<IIncome> {
		const { input } = command;
		const organization = await this.organizationService.findOneByIdString(
			input.organizationId
		);
		try {
			const income = new Income();
			/**
			 * If employee create self income
			 */
			if (!RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)) {
				income.employeeId = RequestContext.currentEmployeeId();
			} else {
				income.employeeId = input.employeeId || null;
			}
			income.clientId = input.clientId;
			income.organizationId = input.organizationId;
			income.amount = input.amount;
			income.valueDate = input.valueDate;
			income.notes = input.notes;
			income.currency = input.currency || organization.currency;
			income.isBonus = input.isBonus;
			income.reference = input.reference;
			income.tags = input.tags;
			income.tenantId = RequestContext.currentTenantId();
			return await this.incomeService.create(income);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
