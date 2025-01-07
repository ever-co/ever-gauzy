import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { IEmployee, PermissionsEnum } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EmployeeUpdateCommand } from './../employee.update.command';
import { EmployeeService } from './../../employee.service';
import { RequestContext } from './../../../core/context';

@CommandHandler(EmployeeUpdateCommand)
export class EmployeeUpdateHandler implements ICommandHandler<EmployeeUpdateCommand> {
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
			throw new BadRequestException(error.message || 'Failed to update employee profile.');
		}
	}
}
