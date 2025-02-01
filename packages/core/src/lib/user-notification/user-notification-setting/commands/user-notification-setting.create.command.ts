import { ICommand } from '@nestjs/cqrs';
import { IUserNotificationSettingCreateInput } from '@gauzy/contracts';

export class UserNotificationSettingCreateCommand implements ICommand {
	static readonly type = '[UserNotificationSetting] Create';

	constructor(public readonly input: IUserNotificationSettingCreateInput) {}
}
