import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { InstallPluginDTO } from '../../../shared';

export class InstallPluginCommand implements ICommand {
	public static readonly type = '[Plugin] Install';
	constructor(public readonly pluginId: ID, public readonly input: InstallPluginDTO) {}
}
