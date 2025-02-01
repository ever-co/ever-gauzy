import { ICommand } from '@nestjs/cqrs';
import { ID, IUserNotificationSettingUpdateInput } from '@gauzy/contracts';

export class UserNotificationSettingUpdateCommand implements ICommand {
	static readonly type = '[UserNotificationSetting] Update';

	constructor(public readonly id: ID, public readonly input: IUserNotificationSettingUpdateInput) {}
}
