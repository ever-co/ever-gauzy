import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class InstallPluginCommand implements ICommand {
	constructor(public readonly pluginId: ID) {}
}
