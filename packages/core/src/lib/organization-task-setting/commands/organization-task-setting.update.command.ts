import { IOrganizationTaskSetting, IOrganizationTaskSettingUpdateInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class OrganizationTaskSettingUpdateCommand implements ICommand {
	static readonly type = '[Organization Task Setting] Update';

	constructor(
		public readonly id: IOrganizationTaskSetting['id'],
		public readonly input: IOrganizationTaskSettingUpdateInput
	) {}
}
