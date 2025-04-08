import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class DeletePluginVersionCommand implements ICommand {
	public static readonly type = '[Plugin] Delete Version';
	constructor(public readonly versionId: ID, public readonly pluginId: ID) {}
}
