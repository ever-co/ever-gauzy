import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class DeactivatePluginCommand implements ICommand {
	public static readonly type = '[Plugin] Deactivate';
	constructor(public readonly pluginId: ID) {}
}
