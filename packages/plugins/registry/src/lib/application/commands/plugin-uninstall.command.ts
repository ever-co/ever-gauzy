import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class PluginUninstallCommand implements ICommand {
	public static readonly type = '[Plugin] Uninstall Command';

	constructor(public readonly pluginId: ID, public readonly input: any) {}
}
