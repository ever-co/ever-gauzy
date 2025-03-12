import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class ActivatePluginCommand implements ICommand {
	constructor(public readonly pluginId: ID) {}
}
