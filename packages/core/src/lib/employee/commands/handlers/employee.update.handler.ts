import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
	BaseEntityEnum,
	checkAgentExitLogoutRestrictionChange,
	IEmployee,
	IEmployeeUpdateInput,
	PermissionsEnum
} from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EmployeeUpdateCommand } from './../employee.update.command';
import { EmployeeService } from './../../employee.service';
import { RequestContext } from './../../../core/context';
import { ActivityLogService } from './../../../activity-log/activity-log.service';
import {
	employeeAgentRestrictionLocations,
	recordAgentRestrictionAcknowledgement
} from './../../agent-exit-logout-restriction';

@CommandHandler(EmployeeUpdateCommand)
export class EmployeeUpdateHandler implements ICommandHandler<EmployeeUpdateCommand> {
	constructor(
		private readonly _employeeService: EmployeeService,
		private readonly _activityLogService: ActivityLogService
	) {}

	/**
	 * Handles the execution of the `EmployeeUpdateCommand`.
	 * Ensures proper permissions are enforced and updates the employee's profile.
	 *
	 * @param command - The `EmployeeUpdateCommand` containing the employee ID and input data.
	 * @returns The updated employee entity.
	 * @throws ForbiddenException if the user lacks permissions or tries to edit another employee's profile.
	 * @throws BadRequestException if the update operation fails.
	 */
	public async execute(command: EmployeeUpdateCommand): Promise<IEmployee> {
		const { id, input } = command;
		const user = RequestContext.currentUser();

		/**
		 * If user/employee has only own profile edit permission
		 */
		if (
			RequestContext.hasPermission(PermissionsEnum.PROFILE_EDIT) &&
			!RequestContext.hasPermission(PermissionsEnum.ORG_EMPLOYEES_EDIT)
		) {
			if (user.employeeId !== id) {
				throw new ForbiddenException('Failed to update employee profile.');
			}
		}

		// Issue #9873: in EEA/UK a worker must always be able to exit and log out of the agent;
		// elsewhere restricting either requires an explicit acknowledgement, recorded against the admin.
		const employee: IEmployee = await this._employeeService.findOneByIdString(id, {
			relations: { organization: { contact: true }, user: true, contact: true }
		});
		// The worker's own location and their organization's: EEA/UK if either is.
		const previousLocation = employeeAgentRestrictionLocations(employee);
		const location = employeeAgentRestrictionLocations(employee, input.contact);
		const { error: restrictionError, newRestrictions } = checkAgentExitLogoutRestrictionChange(
			input,
			employee,
			location,
			previousLocation
		);
		if (restrictionError) {
			throw new BadRequestException(restrictionError);
		}

		// The acknowledgement is a request flag, not an employee column.
		const changes: IEmployeeUpdateInput = { ...input };
		delete changes.acknowledgeAgentExitLogoutRestriction;

		// Written and awaited before the save: no restriction without its recorded acknowledgement.
		if (newRestrictions.length > 0) {
			await recordAgentRestrictionAcknowledgement(this._activityLogService, {
				entity: BaseEntityEnum.Employee,
				entityId: id,
				entityName: employee?.user?.name || employee?.fullName || id,
				organizationId: employee?.organizationId,
				tenantId: employee?.tenantId,
				restricted: newRestrictions
			});
		}

		try {
			// Use `create` to save the entity, ensuring ManyToMany relations are persisted
			return await this._employeeService.create({
				...changes,
				upworkId: changes.upworkId || null,
				linkedInId: changes.linkedInId || null,
				id
			});
		} catch (error) {
			// Handle any errors during the update process
			if (error instanceof BadRequestException || error instanceof ForbiddenException) {
				throw error;
			}
			throw new BadRequestException(error.message || 'Failed to update employee profile.');
		}
	}
}
