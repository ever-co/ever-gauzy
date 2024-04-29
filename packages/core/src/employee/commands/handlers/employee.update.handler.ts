import { IEmployee, PermissionsEnum } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EmployeeUpdateCommand } from './../employee.update.command';
import { EmployeeService } from './../../employee.service';
import { RequestContext } from './../../../core/context';

@CommandHandler(EmployeeUpdateCommand)
export class EmployeeUpdateHandler implements ICommandHandler<EmployeeUpdateCommand> {

	constructor(
		private readonly _employeeService: EmployeeService,
	) { }

	public async execute(command: EmployeeUpdateCommand): Promise<IEmployee> {
		const { id, input } = command;
		/**
		 * If user/employee has only own profile edit permission
		 */
		if (
			RequestContext.hasPermission(PermissionsEnum.PROFILE_EDIT) &&
			!RequestContext.hasPermission(PermissionsEnum.ORG_EMPLOYEES_EDIT)
		) {
			const user = RequestContext.currentUser();
			if (user.employeeId !== id) {
				throw new ForbiddenException();
			}
		}

		try {
			//We are using create here because create calls the method save()
			//We need save() to save ManyToMany relations
			return await this._employeeService.create({
				...input,
				upworkId: input.upworkId || null,
				linkedInId: input.linkedInId || null,
				id
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
