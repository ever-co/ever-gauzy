import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class DeletePluginCommand implements ICommand {
	constructor(public readonly pluginId: ID) {}
}
