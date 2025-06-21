import { ICommand } from '@nestjs/cqrs';
import { PluginSourceDTO } from '../../shared/dto/plugin-source.dto';
import { ID } from '@gauzy/contracts';

export class CreatePluginSourceCommand implements ICommand {
	public static readonly type = '[Plugin Source] Create';
	constructor(
		public readonly pluginId: ID,
		public readonly versionId: ID,
		public readonly input: PluginSourceDTO[]
	) {}
}
