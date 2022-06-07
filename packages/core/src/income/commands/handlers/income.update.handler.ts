import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
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
		let { id } = command;
		const { entity } = command;
		const income = await this.updateIncome(id, entity);
		let averageIncome = 0;
		let averageBonus = 0;
		if (income && income.employeeId) {
			id = income.employeeId;
			const stat = await this.employeeStatisticsService.getStatisticsByEmployeeId(
				id
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

	public async updateIncome(
		incomeId: string,
		entity: IIncome
	): Promise<IIncome> {
		return this.incomeService.create({
			id: incomeId,
			...entity
		});
	}
}
