import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class DeactivatePluginCommand implements ICommand {
	constructor(public readonly pluginId: ID) {}
}
