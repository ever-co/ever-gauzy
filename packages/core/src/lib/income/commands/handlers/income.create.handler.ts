import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IIncome } from '@gauzy/contracts';
import { BadRequestException } from '@nestjs/common';
import { isNotEmpty } from '@gauzy/common';
import { IncomeCreateCommand } from '../income.create.command';
import { IncomeService } from '../../income.service';
import { EmployeeService } from '../../../employee/employee.service';
import { EmployeeStatisticsService } from '../../../employee-statistics';

@CommandHandler(IncomeCreateCommand)
export class IncomeCreateHandler
	implements ICommandHandler<IncomeCreateCommand> {

	constructor(
		private readonly incomeService: IncomeService,
		private readonly employeeService: EmployeeService,
		private readonly employeeStatisticsService: EmployeeStatisticsService
	) {}

	public async execute(command: IncomeCreateCommand): Promise<IIncome> {
		const { input } = command;
		const income = await this.incomeService.create(input);
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
}
