import { ICommand } from '@nestjs/cqrs';
import { PublishPluginDTO } from '../../shared/dto/plugin-publish.dto';
import { ID } from '@gauzy/contracts';

export class PublishPluginCommand implements ICommand {
	public static readonly type = '[Plugin] Publish';

	constructor(
		public readonly publishDto: PublishPluginDTO,
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly userId?: ID
	) {}
}
