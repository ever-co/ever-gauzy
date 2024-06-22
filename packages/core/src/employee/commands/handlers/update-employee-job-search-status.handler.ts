import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { IEmployee } from '@gauzy/contracts';
import { i4netAIService } from '@gauzy/integration-ai';
import { RequestContext } from './../../../core/context';
import { EmployeeService } from '../../employee.service';
import { UpdateEmployeeJobSearchStatusCommand } from '../update-employee-job-search-status.command';

@CommandHandler(UpdateEmployeeJobSearchStatusCommand)
export class UpdateEmployeeJobSearchStatusHandler implements ICommandHandler<UpdateEmployeeJobSearchStatusCommand> {

	constructor(
		private readonly employeeService: EmployeeService,
		private readonly gauzyAIService: i4netAIService
	) { }

	public async execute(
		command: UpdateEmployeeJobSearchStatusCommand
	): Promise<IEmployee | UpdateResult> {

		const { employeeId, input } = command;
		const { isJobSearchActive, organizationId } = input;
		const tenantId = RequestContext.currentTenantId() || input.tenantId;

		const employee = await this.employeeService.findOneByIdString(employeeId, {
			where: {
				organizationId,
				tenantId
			},
			relations: {
				user: true,
				organization: true
			}
		});


		try {
			// Attempt to sync the employee with i4net AI
			const syncResult = await this.gauzyAIService.syncEmployees([employee]);
			try {
				if (syncResult) {
					const { userId } = employee;
					await this.gauzyAIService.updateEmployeeStatus({
						employeeId,
						userId,
						tenantId,
						organizationId,
						isJobSearchActive
					});
					// Employee sync and status update were successful
					console.log('Employee synced and job search status updated successfully.');
				} else {
					// Sync was not successful
					console.log('Employee sync with i4net AI failed.');
				}
			} catch (updateError) {
				// Handle errors during the status update operation
				console.error('Error while updating employee job search status with i4net AI:', updateError.message);
			}
		} catch (syncError) {
			// Handle errors during the sync operation
			console.error('Error while syncing employee with i4net AI:', syncError.message);
		}

		return await this.employeeService.update(employeeId, { isJobSearchActive });
	}
}
