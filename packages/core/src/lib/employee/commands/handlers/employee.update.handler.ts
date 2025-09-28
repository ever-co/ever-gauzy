import { BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { BaseEntityEnum, IEmployee, IEmployeeHourlyRate, PermissionsEnum } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EmployeeUpdateCommand } from './../employee.update.command';
import { EmployeeService } from './../../employee.service';
import { RequestContext } from './../../../core/context';
import { SocketService } from '../../../socket/socket.service';

@CommandHandler(EmployeeUpdateCommand)
export class EmployeeUpdateHandler implements ICommandHandler<EmployeeUpdateCommand> {
	private readonly logger = new Logger(`GZY - ${EmployeeUpdateHandler.name}`);
	constructor(private readonly _employeeService: EmployeeService, private readonly _socketService: SocketService) {}

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
			const employee = await this._employeeService.create({
				...input,
				upworkId: input.upworkId || null,
				linkedInId: input.linkedInId || null,
				id
			});

			if (input.billRateCurrency || input.billRateValue || input.minimumBillingRate) {
				const employee = await this._employeeService.findOneByIdString(id, {
					relations: ['hourlyRates']
				});

				employee.hourlyRates.push({
					billRateCurrency: input.billRateCurrency,
					billRateValue: input.billRateValue || 0,
					minimumBillingRate: input.minimumBillingRate || 0,
					lastUpdate: new Date(),
					entity: BaseEntityEnum.Employee,
					entityId: id,
					employeeId: employee.id
				} as IEmployeeHourlyRate);

				await this._employeeService.save(employee);
			}

			// Send a real-time event to the specified user via socket.
			// No error is thrown if the user is not currently connected.
			this._socketService.sendTimerChanged(user?.employeeId);
			return employee;
		} catch (error) {
			this.logger.error('Error while updating employee', error);
			// Handle any errors during the update process
			throw new BadRequestException(error.message ?? 'Failed to update employee profile.');
		}
	}
}
