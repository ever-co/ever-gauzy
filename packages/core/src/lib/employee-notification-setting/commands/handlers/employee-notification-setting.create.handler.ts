import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IEmployeeNotificationSetting } from '@gauzy/contracts';
import { EmployeeNotificationSettingService } from '../../employee-notification-setting.service';
import { EmployeeNotificationSettingCreateCommand } from '../employee-notification-setting.create.command';

@CommandHandler(EmployeeNotificationSettingCreateCommand)
export class EmployeeNotificationSettingCreateHandler
	implements ICommandHandler<EmployeeNotificationSettingCreateCommand>
{
	constructor(private readonly employeeNotificationSettingService: EmployeeNotificationSettingService) {}

	/**
	 * Handles the EmployeeNotificationSettingCreateCommand to create a new employee notification setting.
	 *
	 * @param command - The command containing the input data for employee notification setting creation.
	 * @returns A promise that resolves to the created employee notification setting.
	 */
	public async execute(command: EmployeeNotificationSettingCreateCommand): Promise<IEmployeeNotificationSetting> {
		const { input } = command;

		if (!input) {
			throw new Error('Input is required for creating notification setting');
		}

		try {
			return this.employeeNotificationSettingService.create(input);
		} catch (error) {
			// Log error details
			throw new Error(`Failed to create notification setting: ${error.message}`);
		}
	}
}
