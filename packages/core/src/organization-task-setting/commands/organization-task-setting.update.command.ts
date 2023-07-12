import { IOrganizationTaskSettingUpdateInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class OrganizationTaskSettingUpdateCommand implements ICommand {
	static readonly type = '[OrganizationTaskSetting] Update';

	constructor(
		public readonly id: string,
		public readonly input: IOrganizationTaskSettingUpdateInput
	) {}
}
