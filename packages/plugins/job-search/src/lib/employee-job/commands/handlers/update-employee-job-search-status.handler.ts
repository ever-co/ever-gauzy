import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { IEmployee } from '@gauzy/contracts';
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
		const { employeeId, input } = command;
		const { isJobSearchActive, organizationId } = input;
		const tenantId = RequestContext.currentTenantId() || input.tenantId;

		const employee = await this.employeeService.findOneByIdString(employeeId, {
			where: { organizationId, tenantId },
			relations: { user: true, organization: true }
		});

		try {
			// Attempt to sync the employee with Gauzy AI
			const syncResult = await this.gauzyAIService.syncEmployees([employee]);

			if (syncResult) {
				const { userId } = employee;
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
