import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IEmployee } from '@gauzy/contracts';
import { GauzyAIService } from '@gauzy/integration-ai';
import { UpdateResult } from 'typeorm';
import { RequestContext } from './../../../core/context';
import { EmployeeService } from '../../employee.service';
import { UpdateEmployeeJobSearchStatusCommand } from '../update-employee-job-search-status.command';

@CommandHandler(UpdateEmployeeJobSearchStatusCommand)
export class UpdateEmployeeJobSearchStatusHandler
	implements ICommandHandler<UpdateEmployeeJobSearchStatusCommand>
{
	constructor(
		private readonly employeeService: EmployeeService,
		private readonly gauzyAIService: GauzyAIService
	) { }

	public async execute(
		command: UpdateEmployeeJobSearchStatusCommand
	): Promise<IEmployee | UpdateResult> {
		const { employeeId, input } = command;
		const { isJobSearchActive, organizationId, tenantId } = input;

		try {
			const employee = await this.employeeService.findOneByIdString(employeeId, {
				where: {
					organizationId,
					tenantId: RequestContext.currentTenantId()
				},
				relations: {
					user: true
				}
			});

			/** Sync before update employee job search status */
			await this.gauzyAIService.syncEmployees([employee]);

			this.gauzyAIService.updateEmployeeStatus(
				employeeId,
				tenantId,
				organizationId,
				isJobSearchActive
			);
		} catch (error) {
			console.log('Error while updating employee job search status', error);
		}

		return await this.employeeService.update(employeeId, {
			isJobSearchActive
		});
	}
}
