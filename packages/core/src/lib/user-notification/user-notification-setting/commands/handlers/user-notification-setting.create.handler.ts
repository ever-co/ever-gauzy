import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IUserNotificationSetting } from '@gauzy/contracts';
import { UserNotificationSettingService } from '../../user-notification-setting.service';
import { UserNotificationSettingCreateCommand } from '../user-notification-setting.create.command';

@CommandHandler(UserNotificationSettingCreateCommand)
export class UserNotificationSettingCreateHandler implements ICommandHandler<UserNotificationSettingCreateCommand> {
	constructor(private readonly userNotificationSettingService: UserNotificationSettingService) {}

	/**
	 * Handles the UserNotificationSettingCreateCommand to create a new user notification setting.
	 *
	 * @param command - The command containing the input data for user notification setting creation.
	 * @returns A promise that resolves to the created user notification setting.
	 */
	public async execute(command: UserNotificationSettingCreateCommand): Promise<IUserNotificationSetting> {
		const { input } = command;
		return this.userNotificationSettingService.create(input);
	}
}
