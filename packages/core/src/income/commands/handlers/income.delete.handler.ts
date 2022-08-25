import { ForbiddenException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { isNotEmpty } from '@gauzy/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { IncomeService } from '../../income.service';
import { EmployeeService } from '../../../employee/employee.service';
import { EmployeeStatisticsService } from '../../../employee-statistics';
import { IncomeDeleteCommand } from '../income.delete.command';
import { RequestContext } from './../../../core/context';

@CommandHandler(IncomeDeleteCommand)
export class IncomeDeleteHandler
	implements ICommandHandler<IncomeDeleteCommand> {
	constructor(
		private readonly incomeService: IncomeService,
		private readonly employeeService: EmployeeService,
		private readonly employeeStatisticsService: EmployeeStatisticsService
	) {}

	public async execute(command: IncomeDeleteCommand): Promise<DeleteResult> {
		const { employeeId, incomeId } = command;
		const result = await this.deleteIncome(incomeId);

		if (isNotEmpty(employeeId)) {
			const id = employeeId;
			let averageIncome = 0;
			let averageBonus = 0;

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
		return result;
	}

	public async deleteIncome(incomeId: string): Promise<DeleteResult> {
		try {
			if (RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)) {
				return await this.incomeService.delete(incomeId);
			} else {
				return await this.incomeService.delete({
					id: incomeId,
					employeeId: RequestContext.currentEmployeeId(),
					tenantId: RequestContext.currentTenantId()
				});
			}
		} catch (error) {
			throw new ForbiddenException();
		}
	}
}
