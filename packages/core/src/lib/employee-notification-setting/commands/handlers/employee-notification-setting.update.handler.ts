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

		if (!id || !input) {
			throw new Error('Both id and input are required for updating notification setting');
		}

		try {
			// Update the employee notification setting
			const employeeNotificationSetting = await this.employeeNotificationSettingService.update(id, input);

			// Check if the result is an instance of UpdateResult
			if (employeeNotificationSetting instanceof UpdateResult) {
				// Fetch and return the updated entity
				return this.employeeNotificationSettingService.findOneByIdString(id);
			}

			return employeeNotificationSetting;
		} catch (error) {
			// Log error details
			throw new Error(`Failed to update notification setting: ${error.message}`);
		}
	}
}
