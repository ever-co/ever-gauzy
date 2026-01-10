import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { UpdatePluginSettingDTO } from '../../../shared';

export class UpdatePluginSettingCommand implements ICommand {
	public static readonly type = '[Plugin Setting] Update';

	constructor(
		public readonly id: ID,
		public readonly updateDto: UpdatePluginSettingDTO,
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly userId?: ID
	) {}
}
