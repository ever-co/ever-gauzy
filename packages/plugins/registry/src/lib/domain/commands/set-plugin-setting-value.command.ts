import { ICommand } from '@nestjs/cqrs';
import { SetPluginSettingValueDTO } from '../../shared/dto/plugin-setting.dto';
import { ID } from '@gauzy/contracts';

export class SetPluginSettingValueCommand implements ICommand {
	public static readonly type = '[Plugin Setting] Set Value';

	constructor(
		public readonly setValueDto: SetPluginSettingValueDTO,
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly userId?: ID
	) {}
}
