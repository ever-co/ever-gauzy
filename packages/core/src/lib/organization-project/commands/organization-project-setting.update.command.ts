import { ICommand } from '@nestjs/cqrs';
import { ID, IOrganizationProjectSetting } from '@gauzy/contracts';

export class OrganizationProjectSettingUpdateCommand implements ICommand {
	static readonly type = '[Organization Project Setting] Update';

	constructor(public readonly id: ID, public readonly input: IOrganizationProjectSetting) {}
}
