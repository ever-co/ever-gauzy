import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

export class PluginInstallCommand implements ICommand {
	public static readonly type = '[Plugin] Install Command';
	
	constructor(public readonly pluginId: ID, public readonly input: any) {}
}