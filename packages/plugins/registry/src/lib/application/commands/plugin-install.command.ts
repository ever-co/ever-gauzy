import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class PluginInstallCommand implements ICommand {
	public static readonly type = '[Plugin] Install Command';

	constructor(public readonly pluginId: ID, public readonly input: any) {}
}
