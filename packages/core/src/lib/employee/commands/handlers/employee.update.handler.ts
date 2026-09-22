import { BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { IEmployee, validateAgentExitLogoutRestriction, PermissionsEnum } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EmployeeUpdateCommand } from './../employee.update.command';
import { EmployeeService } from './../../employee.service';
import { RequestContext } from './../../../core/context';

@CommandHandler(EmployeeUpdateCommand)
export class EmployeeUpdateHandler implements ICommandHandler<EmployeeUpdateCommand> {
	private readonly logger = new Logger(EmployeeUpdateHandler.name);

	constructor(private readonly _employeeService: EmployeeService) {}

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

		// Check if attempting to set allowAgentAppExit or allowLogoutFromAgentApp to false
		if (input.allowAgentAppExit === false || input.allowLogoutFromAgentApp === false) {
			const employee: IEmployee = await this._employeeService.findOneByIdString(id, {
				relations: { organization: { contact: true }, user: true, contact: true }
			});

			const errorMsg = validateAgentExitLogoutRestriction(input, {
				regionCode: employee?.organization?.regionCode || employee?.contact?.regionCode,
				timeZone: employee?.user?.timeZone || employee?.organization?.timeZone,
				country: employee?.contact?.country || employee?.organization?.contact?.country
			});

			if (errorMsg) {
				throw new BadRequestException(errorMsg);
			}

			if (input.acknowledgeAgentExitLogoutRestriction) {
				const currentUserId = RequestContext.currentUserId();
				this.logger.log(
					`[AGENT_RESTRICTION_ACKNOWLEDGEMENT] Admin User ${currentUserId} explicitly acknowledged legal/compliance risk for setting exit/logout restriction on Employee ID: ${id} at ${new Date().toISOString()}`
				);
			}
		}

		try {
			// Use `create` to save the entity, ensuring ManyToMany relations are persisted
			return await this._employeeService.create({
				...input,
				upworkId: input.upworkId || null,
				linkedInId: input.linkedInId || null,
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
