import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { IPluginSource } from '../../../shared';

export class CreatePluginSourceCommand implements ICommand {
	public static readonly type = '[Plugin Source] Create';
	constructor(
		public readonly pluginId: ID,
		public readonly versionId: ID,
		public readonly input: IPluginSource[]
	) { }
}
