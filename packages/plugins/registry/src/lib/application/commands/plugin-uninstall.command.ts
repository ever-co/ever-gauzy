import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

export class PluginUninstallCommand implements ICommand {
	public static readonly type = '[Plugin] Uninstall Command';
	
	constructor(public readonly pluginId: ID, public readonly input: any) {}
}