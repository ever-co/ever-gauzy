import { ForbiddenException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { IEmployee } from '@gauzy/contracts';
import { GauzyAIService } from '@gauzy/integration-ai';
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
					const { userId } = employee;
					this.gauzyAIService.updateEmployeeStatus({
						employeeId,
						userId,
						tenantId,
						organizationId,
						isJobSearchActive
					});
				}
			} catch (error) {
				console.log('Error while updating employee job search status with Gauzy AI: %s', error);
			}
		} catch (error) {
			console.log('API key and secret key are required: %s', error?.message);
			throw new ForbiddenException('API key and secret key are required.');
		}

		return await this.employeeService.update(employeeId, {
			isJobSearchActive
		});
	}
}
