import { IOrganizationProjectTasksSettingsUpdateInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class OrganizationProjectTasksSettingsUpdateCommand implements ICommand {
	static readonly type = '[OrganizationProjectTasksSettings] Update';

	constructor(public readonly id: string, public readonly input: IOrganizationProjectTasksSettingsUpdateInput) {}
}
