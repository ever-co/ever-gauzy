import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { isNotEmpty } from '@gauzy/common';
import { IIncome } from '@gauzy/contracts';
import { IncomeService } from '../../income.service';
import { EmployeeService } from '../../../employee/employee.service';
import { EmployeeStatisticsService } from '../../../employee-statistics';
import { IncomeUpdateCommand } from '../income.update.command';

@CommandHandler(IncomeUpdateCommand)
export class IncomeUpdateHandler implements
	ICommandHandler<IncomeUpdateCommand> {

	constructor(
		private readonly incomeService: IncomeService,
		private readonly employeeService: EmployeeService,
		private readonly employeeStatisticsService: EmployeeStatisticsService
	) {}

	public async execute(command: IncomeUpdateCommand): Promise<IIncome> {
		const { id, entity } = command;
		const income = await this.updateIncome(id, entity);
		try {
			let averageIncome = 0;
			let averageBonus = 0;
			if (isNotEmpty(income.employeeId)) {
				const { employeeId } = income;
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

	public async updateIncome(
		incomeId: string,
		entity: IIncome
	): Promise<IIncome> {
		try {
			return this.incomeService.create({
				id: incomeId,
				...entity
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
