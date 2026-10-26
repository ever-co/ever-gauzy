import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, Logger } from '@nestjs/common';
import { isNotEmpty } from '@gauzy/utils';
import { ID, IIncome } from '@gauzy/contracts';
import { IncomeService } from '../../income.service';
import { EmployeeService } from '../../../employee/employee.service';
import { EmployeeStatisticsService } from '../../../employee-statistics';
import { IncomeUpdateCommand } from '../income.update.command';

@CommandHandler(IncomeUpdateCommand)
export class IncomeUpdateHandler implements ICommandHandler<IncomeUpdateCommand> {
	private readonly logger = new Logger(IncomeUpdateHandler.name);

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

			if (isNotEmpty(employeeId)) {
				await this.refreshAverages(employeeId);
			}
			return income;
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * The income is already saved at this point: a failed refresh (e.g. the income still points to a
	 * soft-deleted employee) is logged instead of reporting the saved update as failed.
	 */
	private async refreshAverages(employeeId: ID): Promise<void> {
		try {
			const stat = await this.employeeStatisticsService.getStatisticsByEmployeeId(employeeId);
			await this.employeeService.create({
				id: employeeId,
				averageIncome: this.incomeService.countStatistic(stat.incomeStatistics),
				averageBonus: this.incomeService.countStatistic(stat.bonusStatistics)
			});
		} catch (error) {
			this.logger.warn(`Averages of employee ${employeeId} not refreshed: ${error?.message ?? error}`);
		}
	}
}
