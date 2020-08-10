import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IncomeService } from '../../income.service';
import { EmployeeService } from '../../../employee/employee.service';
import { EmployeeStatisticsService } from '../../../employee-statistics';
import { IncomeDeleteCommand } from '../income.delete.command';

@CommandHandler(IncomeDeleteCommand)
export class IncomeDeleteHandler
	implements ICommandHandler<IncomeDeleteCommand> {
	constructor(
		private readonly incomeService: IncomeService,
		private readonly employeeService: EmployeeService,
		private readonly employeeStatisticsService: EmployeeStatisticsService
	) {}

	public async execute(command: IncomeDeleteCommand): Promise<any> {
		const { employeeId, incomeId } = command;
		const id = employeeId;
		let averageIncome = 0;
		let averageBonus = 0;
		await this.deleteIncome(incomeId);

		const stat = await this.employeeStatisticsService.getStatisticsByEmployeeId(
			id
		);

		averageIncome = this.incomeService.countStatistic(
			stat.incomeStatistics
		);
		averageBonus = this.incomeService.countStatistic(stat.bonusStatistics);
		return await this.employeeService.create({
			id,
			averageIncome: averageIncome,
			averageBonus: averageBonus
		});
	}

	public async deleteIncome(incomeId: string): Promise<any> {
		return await this.incomeService.delete(incomeId);
	}
}
