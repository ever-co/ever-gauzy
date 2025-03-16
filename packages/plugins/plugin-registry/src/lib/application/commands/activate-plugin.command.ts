import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class ActivatePluginCommand implements ICommand {
	public static readonly type = '[Plugin] Activate';
	constructor(public readonly pluginId: ID) {}
}
