import { ICommand } from '@nestjs/cqrs';
import { InstallPluginDTO } from '../../shared/dto/install-plugin.dto';

export class InstallPluginCommand implements ICommand {
	public static readonly type = '[Plugin] Install';
	constructor(public readonly input: InstallPluginDTO) {}
}
