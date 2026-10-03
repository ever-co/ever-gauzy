import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { isNotEmpty } from '@gauzy/utils';
import { IIncome } from '@gauzy/contracts';
import { IncomeService } from '../../income.service';
import { EmployeeService } from '../../../employee/employee.service';
import { EmployeeStatisticsService } from '../../../employee-statistics';
import { IncomeUpdateCommand } from '../income.update.command';

@CommandHandler(IncomeUpdateCommand)
export class IncomeUpdateHandler implements ICommandHandler<IncomeUpdateCommand> {
	constructor(
		private readonly incomeService: IncomeService,
		private readonly employeeService: EmployeeService,
		private readonly employeeStatisticsService: EmployeeStatisticsService
	) {}

	public async execute(command: IncomeUpdateCommand): Promise<IIncome> {
		const { id, entity } = command;
		try {
			const existing = await this.incomeService.findOneByIdString(id);
			const income = await this.incomeService.create({ ...entity, id });

			// The update DTO does not accept `employeeId` (it is whitelisted out), so the saved partial has none:
			// take the employee from the stored income to refresh that employee's averages.
			const employeeId = income.employeeId ?? existing.employeeId;

			let averageIncome = 0;
			let averageBonus = 0;
			if (isNotEmpty(employeeId)) {
				const stat = await this.employeeStatisticsService.getStatisticsByEmployeeId(employeeId);
				averageIncome = this.incomeService.countStatistic(stat.incomeStatistics);
				averageBonus = this.incomeService.countStatistic(stat.bonusStatistics);
				await this.employeeService.create({
					id: employeeId,
					averageIncome: averageIncome,
					averageBonus: averageBonus
				});
			}
			return income;
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
