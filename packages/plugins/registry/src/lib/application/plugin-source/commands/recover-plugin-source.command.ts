import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class RecoverPluginSourceCommand implements ICommand {
	public static readonly type = '[Plugin Source] Recover';
	constructor(public readonly sourceId: ID, public readonly versionId: ID, public readonly pluginId: ID) {}
}
