import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class DeletePluginSourceCommand implements ICommand {
	public static readonly type = '[Plugin] Delete Source';
	constructor(public readonly sourceId: ID, public readonly versionId: ID, public readonly pluginId: ID) {}
}
