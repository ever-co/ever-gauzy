import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { IPluginTagBulkUpdateInput, IPluginTagPriorityUpdateInput, IPluginTagUpdateInput } from '../../../shared';

/**
 * Command to update a single plugin-tag relationship
 */
export class UpdatePluginTagCommand implements ICommand {
	static readonly type = '[PluginTag] Update';

	constructor(public readonly id: ID, public readonly input: IPluginTagUpdateInput) {}
}

/**
 * Command to bulk update plugin-tag relationships
 */
export class BulkUpdatePluginTagsCommand implements ICommand {
	static readonly type = '[PluginTag] Bulk Update';

	constructor(public readonly updates: IPluginTagBulkUpdateInput[]) {}
}

/**
 * Command to update priority order of plugin tags
 */
export class UpdatePluginTagsPriorityCommand implements ICommand {
	static readonly type = '[PluginTag] Update Priority';

	constructor(public readonly priorities: IPluginTagPriorityUpdateInput[]) {}
}
