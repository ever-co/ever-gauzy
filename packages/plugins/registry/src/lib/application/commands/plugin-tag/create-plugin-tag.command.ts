import { ICommand } from '@nestjs/cqrs';
import { IPluginTagCreateInput } from '../../../shared/models/plugin-tag.model';

/**
 * Command to create a new plugin-tag relationship
 */
export class CreatePluginTagCommand implements ICommand {
	static readonly type = '[PluginTag] Create Plugin Tag';

	constructor(public readonly input: IPluginTagCreateInput) {}
}
