import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { IEmployeeNotificationSetting } from '@gauzy/contracts';
import { EmployeeNotificationSettingService } from '../../employee-notification-setting.service';
import { EmployeeNotificationSettingUpdateCommand } from '../employee-notification-setting.update.command';

@CommandHandler(EmployeeNotificationSettingUpdateCommand)
export class EmployeeNotificationSettingUpdateHandler
	implements ICommandHandler<EmployeeNotificationSettingUpdateCommand>
{
	constructor(private readonly employeeNotificationSettingService: EmployeeNotificationSettingService) {}

	/**
	 * Handles the EmployeeNotificationSettingUpdateCommand to Update an employee notification setting.
	 *
	 * @param command - The command containing the input data for employee notification setting update.
	 * @returns A promise that resolves to the updated employee notification setting.
	 */
	public async execute(
		command: EmployeeNotificationSettingUpdateCommand
	): Promise<IEmployeeNotificationSetting | UpdateResult> {
		const { id, input } = command;
		return this.employeeNotificationSettingService.update(id, input);
	}
}
