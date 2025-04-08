import { ICommand } from '@nestjs/cqrs';
import { InstallPluginDTO } from '../../shared/dto/install-plugin.dto';
import { ID } from '@gauzy/contracts';

export class InstallPluginCommand implements ICommand {
	public static readonly type = '[Plugin] Install';
	constructor(public readonly pluginId: ID, public readonly input: InstallPluginDTO) {}
}
