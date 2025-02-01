import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { IUserNotificationSetting } from '@gauzy/contracts';
import { UserNotificationSettingService } from '../../user-notification-setting.service';
import { UserNotificationSettingUpdateCommand } from '../user-notification-setting.update.command';

@CommandHandler(UserNotificationSettingUpdateCommand)
export class UserNotificationSettingUpdateHandler implements ICommandHandler<UserNotificationSettingUpdateCommand> {
	constructor(private readonly userNotificationSettingService: UserNotificationSettingService) {}

	/**
	 * Handles the UserNotificationSettingUpdateCommand to Update an user notification setting.
	 *
	 * @param command - The command containing the input data for user notification setting update.
	 * @returns A promise that resolves to the updated user notification setting.
	 */
	public async execute(
		command: UserNotificationSettingUpdateCommand
	): Promise<IUserNotificationSetting | UpdateResult> {
		const { id, input } = command;
		return this.userNotificationSettingService.update(id, input);
	}
}
