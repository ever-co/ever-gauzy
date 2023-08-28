import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IEmployee } from '@gauzy/contracts';
import { GauzyAIService } from '@gauzy/integration-ai';
import { UpdateResult } from 'typeorm';
import { RequestContext } from './../../../core/context';
import { EmployeeService } from '../../employee.service';
import { UpdateEmployeeJobSearchStatusCommand } from '../update-employee-job-search-status.command';

@CommandHandler(UpdateEmployeeJobSearchStatusCommand)
export class UpdateEmployeeJobSearchStatusHandler implements ICommandHandler<UpdateEmployeeJobSearchStatusCommand> {

	constructor(
		private readonly employeeService: EmployeeService,
		private readonly gauzyAIService: GauzyAIService
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
			/** Sync before update employee job search status */
			const synced = await this.gauzyAIService.syncEmployees([employee]);
			try {
				if (synced) {
					this.gauzyAIService.updateEmployeeStatus(
						employeeId,
						tenantId,
						organizationId,
						isJobSearchActive
					);
				}
			} catch (error) {
				console.log('Error while updating employee job search status with Gauzy AI: %s', error);
			}
		} catch (error) {
			console.log('Error while sync employee with Gauzy AI: %s', error);
		}

		return await this.employeeService.update(employeeId, {
			isJobSearchActive
		});
	}
}
