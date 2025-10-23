import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { IPluginTagBulkDeleteInput } from '../../shared/models/plugin-tag.model';

/**
 * Command to delete a plugin-tag relationship
 */
export class DeletePluginTagCommand implements ICommand {
	static readonly type = '[PluginTag] Delete Plugin Tag';

	constructor(public readonly id: ID) {}
}

/**
 * Command to bulk delete plugin-tag relationships
 */
export class BulkDeletePluginTagsCommand implements ICommand {
	static readonly type = '[PluginTag] Bulk Delete Plugin Tags';

	constructor(public readonly input: IPluginTagBulkDeleteInput) {}
}

/**
 * Command to replace all tags for a plugin
 */
export class ReplacePluginTagsCommand implements ICommand {
	static readonly type = '[PluginTag] Replace Plugin Tags';

	constructor(
		public readonly pluginId: ID,
		public readonly tagIds: ID[],
		public readonly tenantId?: ID,
		public readonly organizationId?: ID
	) {}
}
