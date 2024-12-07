import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
export class IncomeDeleteHandler implements ICommandHandler<IncomeDeleteCommand> {
	constructor(
		private readonly incomeService: IncomeService,
		private readonly employeeService: EmployeeService,
		private readonly employeeStatisticsService: EmployeeStatisticsService
	) {}

	/**
	 * Deletes an income record and updates the employee's statistics if necessary.
	 *
	 * @param command - The command containing the income ID to delete and the optional employee ID.
	 * @returns A promise that resolves with the result of the delete operation.
	 * @throws BadRequestException if there is an error updating employee statistics.
	 */
	public async execute(command: IncomeDeleteCommand): Promise<DeleteResult> {
		const { incomeId, employeeId } = command;
		// Delete the income
		const result = await this.deleteIncome(incomeId);

		try {
			if (isNotEmpty(employeeId)) {
				// Fetch statistics and calculate averages
				const stat = await this.employeeStatisticsService.getStatisticsByEmployeeId(employeeId);
				const averageIncome = this.incomeService.countStatistic(stat.incomeStatistics);
				const averageBonus = this.incomeService.countStatistic(stat.bonusStatistics);

				// Update employee with the calculated averages
				await this.employeeService.create({
					id: employeeId,
					averageIncome,
					averageBonus
				});
			}
		} catch (error) {
			throw new BadRequestException('Error while updating employee statistics', error);
		}

		return result;
	}

	/**
	 * Deletes income by ID with permission check
	 *
	 * @param incomeId - The ID of the income to delete
	 * @returns Promise<DeleteResult> - The result of the delete operation
	 */
	public async deleteIncome(incomeId: string): Promise<DeleteResult> {
		const deleteQuery = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
			? { id: incomeId }
			: {
					id: incomeId,
					employeeId: RequestContext.currentEmployeeId(),
					tenantId: RequestContext.currentTenantId()
			  };

		try {
			return await this.incomeService.delete(deleteQuery);
		} catch (error) {
			throw new ForbiddenException('You do not have permission to delete this income.');
		}
	}
}
