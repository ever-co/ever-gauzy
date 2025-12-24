import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class RecoverPluginVersionCommand implements ICommand {
	public static readonly type = '[Plugin Version] Recover';
	constructor(public readonly versionId: ID, public readonly pluginId: ID) {}
}
