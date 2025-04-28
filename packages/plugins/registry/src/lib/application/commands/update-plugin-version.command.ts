import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { UpdatePluginVersionDTO } from '../../shared/dto/update-plugin-version.dto';

export class UpdatePluginVersionCommand implements ICommand {
	public static readonly type = '[Plugin Version] Update';
	constructor(
		public readonly pluginId: ID,
		public readonly versionId: ID,
		public readonly input: UpdatePluginVersionDTO
	) {}
}
