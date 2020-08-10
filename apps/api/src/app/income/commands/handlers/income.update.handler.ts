import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IncomeService } from '../../income.service';
import { EmployeeService } from '../../../employee/employee.service';
import { EmployeeStatisticsService } from '../../../employee-statistics';
import { IncomeUpdateCommand } from '../income.update.command';
import { Income } from '@gauzy/models';

@CommandHandler(IncomeUpdateCommand)
export class IncomeUpdateHandler
	implements ICommandHandler<IncomeUpdateCommand> {
	constructor(
		private readonly incomeService: IncomeService,
		private readonly employeeService: EmployeeService,
		private readonly employeeStatisticsService: EmployeeStatisticsService
	) {}

	public async execute(command: IncomeUpdateCommand): Promise<any> {
		let { id } = command;
		const { entity } = command;
		const income = await this.updateIncome(id, entity);
		let averageIncome = 0;
		let averageBonus = 0;
		if (income) {
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

			return await this.employeeService.create({
				id,
				averageIncome: averageIncome,
				averageBonus: averageBonus
			});
		}
	}

	public async updateIncome(
		incomeId: string,
		entity: Income
	): Promise<Income> {
		const id = incomeId;
		return this.incomeService.create({
			id,
			...entity
		});
	}
}
