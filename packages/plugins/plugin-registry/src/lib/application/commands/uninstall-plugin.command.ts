import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class UninstallPluginCommand implements ICommand {
	public static readonly type = '[Plugin] Uninstall';
	constructor(public readonly pluginId: ID) {}
}
