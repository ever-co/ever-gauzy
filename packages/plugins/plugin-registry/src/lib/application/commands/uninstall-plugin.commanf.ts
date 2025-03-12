import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class UninstallPluginCommand implements ICommand {
	constructor(public readonly pluginId: ID) {}
}
