import { ICommand } from '@nestjs/cqrs';
import { CreatePluginSettingDTO } from '../../shared/dto/plugin-setting.dto';
import { ID } from '@gauzy/contracts';

export class CreatePluginSettingCommand implements ICommand {
	public static readonly type = '[Plugin Setting] Create';

	constructor(
		public readonly createDto: CreatePluginSettingDTO,
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly userId?: ID
	) {}
}
