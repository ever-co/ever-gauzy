import { ICommand } from '@nestjs/cqrs';
import { IOrganizationProject, IOrganizationProjectSetting } from '@gauzy/contracts';

export class OrganizationProjectSettingUpdateCommand implements ICommand {
	static readonly type = '[Organization Project Setting] Update';

	constructor(
		public readonly id: IOrganizationProject['id'],
		public readonly input: IOrganizationProjectSetting
	) { }
}
