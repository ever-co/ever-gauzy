import { ICommand } from '@nestjs/cqrs';
import { InstallPluginDTO } from '../../shared/dto/install-plugin.dto';

export class InstallPluginCommand implements ICommand {
	constructor(public readonly input: InstallPluginDTO) {}
}
