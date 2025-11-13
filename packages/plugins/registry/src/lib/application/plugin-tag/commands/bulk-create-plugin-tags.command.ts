import { ICommand } from '@nestjs/cqrs';
import { IPluginTagBulkCreateInput } from '../../shared/models/plugin-tag.model';

/**
 * Command to bulk create plugin-tag relationships
 */
export class BulkCreatePluginTagsCommand implements ICommand {
	static readonly type = '[PluginTag] Bulk Create Plugin Tags';

	constructor(public readonly input: IPluginTagBulkCreateInput) {}
}
