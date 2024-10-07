import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import { ID, IEmployee, PermissionsEnum } from '@gauzy/contracts';
import { GauzyAIService } from '@gauzy/plugin-integration-ai';
import { EmployeeService, RequestContext } from '@gauzy/core';
import { UpdateEmployeeJobSearchStatusCommand } from '../update-employee-job-search-status.command';

@CommandHandler(UpdateEmployeeJobSearchStatusCommand)
export class UpdateEmployeeJobSearchStatusHandler implements ICommandHandler<UpdateEmployeeJobSearchStatusCommand> {
	constructor(private readonly employeeService: EmployeeService, private readonly gauzyAIService: GauzyAIService) {}

	/**
	 * Executes the command to update an employee's job search status.
	 *
	 * @param command - The command containing the employee ID and input data.
	 * @returns A promise resolving to the updated employee or the update result.
	 */
	public async execute(command: UpdateEmployeeJobSearchStatusCommand): Promise<IEmployee | UpdateResult> {
		const { input } = command;
		const { isJobSearchActive, organizationId } = input;

		let employeeId: ID = command.employeeId;
		const tenantId: ID = RequestContext.currentTenantId() ?? input.tenantId;

		// Check for permission CHANGE_SELECTED_EMPLOYEE
		if (!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			// Filter by current employee ID if the permission is not present
			employeeId = RequestContext.currentEmployeeId();
		}

		// Find the employee by ID
		const employee = await this.employeeService.findOneByIdString(employeeId, {
			where: { organizationId, tenantId },
			relations: { user: true, organization: true }
		});

		// Check if employee was found
		if (!employee) {
			throw new BadRequestException(
				`Employee with ID ${employeeId} not found. Please check the ID and try again.`
			);
		}

		try {
			// Get the user ID from the employee
			const userId = employee.userId;

			// Attempt to sync the employee with Gauzy AI
			const syncResult = await this.gauzyAIService.syncEmployees([employee]);

			if (syncResult) {
				try {
					await this.gauzyAIService.updateEmployeeStatus({
						employeeId,
						userId,
						tenantId,
						organizationId,
						isJobSearchActive
					});
					// Employee sync and status update were successful
					console.log('Employee synced and job search status updated successfully.');
				} catch (error) {
					// Handle errors during the status update operation
					console.error('Error while updating employee job search status with Gauzy AI:', error.message);
				}
			} else {
				// Sync was not successful
				console.log('Employee sync with Gauzy AI failed.');
			}
		} catch (error) {
			// Handle errors during the sync operation
			console.error('Error while syncing employee with Gauzy AI:', error.message);
		}

		// Update the employee's job search status locally
		return await this.employeeService.update(employeeId, { isJobSearchActive });
	}
}
