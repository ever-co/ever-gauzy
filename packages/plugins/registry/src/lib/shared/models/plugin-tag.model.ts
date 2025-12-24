import type { IBasePerTenantAndOrganizationEntityModel, ID, IPluginTag as PluginTagModel } from '@gauzy/contracts';

/**
 * Interface representing a Plugin-Tag relationship entity.
 * This interface defines the many-to-many relationship between plugins and tags,
 * allowing plugins to be categorized and filtered by multiple tags.
 */
export interface IPluginTag extends PluginTagModel {}

/**
 * Input interface for creating a new plugin-tag relationship.
 * Used when associating tags with plugins.
 */
export interface IPluginTagCreateInput extends Pick<IPluginTag, 'pluginId' | 'tagId'> {
	/**
	 * Optional tenant and organization context for multi-tenant scenarios
	 */
	tenantId?: ID;
	organizationId?: ID;
}

/**
 * Input interface for updating a plugin-tag relationship.
 * Currently, plugin-tag relationships are typically created or deleted,
 * not updated, but this interface is provided for consistency.
 */
export interface IPluginTagUpdateInput extends Partial<IPluginTagCreateInput> {}

/**
 * Input interface for finding plugin-tag relationships with optional filters.
 * Used for querying plugin-tag associations.
 */
export type IPluginTagFindInput = Partial<IPluginTagUpdateInput>;

/**
 * Input interface for bulk operations on plugin-tag relationships.
 * Used when associating multiple tags with a plugin or multiple plugins with a tag.
 */
export interface IPluginTagBulkCreateInput {
	/**
	 * Plugin ID for the associations
	 */
	pluginId: ID;

	/**
	 * Array of tag IDs to associate with the plugin
	 */
	tagIds: ID[];

	/**
	 * Optional tenant and organization context for multi-tenant scenarios
	 */
	tenantId?: ID;
	organizationId?: ID;
}

/**
 * Response interface for bulk operations on plugin-tag relationships.
 */
export interface IPluginTagBulkCreateResponse {
	/**
	 * Number of plugin-tag relationships created
	 */
	created: number;

	/**
	 * Number of plugin-tag relationships that already existed
	 */
	existing: number;

	/**
	 * Array of created plugin-tag relationships
	 */
	pluginTags: IPluginTag[];
}

/**
 * Input interface for bulk deletion of plugin-tag relationships.
 */
export interface IPluginTagBulkDeleteInput {
	/**
	 * Plugin ID for the deletions
	 */
	pluginId?: ID;

	/**
	 * Tag ID for the deletions
	 */
	tagId?: ID;

	/**
	 * Array of specific plugin-tag relationship IDs to delete
	 */
	ids?: ID[];

	/**
	 * Array of tag IDs to disassociate from a plugin
	 */
	tagIds?: ID[];

	/**
	 * Optional tenant and organization context for multi-tenant scenarios
	 */
	tenantId?: ID;
	organizationId?: ID;
}

/**
 * Query interface for retrieving plugins by tags.
 * Used for advanced filtering and search operations.
 */
export interface IPluginsByTagsQuery extends IBasePerTenantAndOrganizationEntityModel {
	/**
	 * Array of tag IDs to filter by
	 */
	tagIds: ID[];

	/**
	 * Match type - 'any' for plugins with any of the tags, 'all' for plugins with all tags
	 */
	matchType?: 'any' | 'all';

	/**
	 * Include tag information in the response
	 */
	includeTags?: boolean;

	/**
	 * Include plugin details in the response
	 */
	includePluginDetails?: boolean;
}

/**
 * Query interface for retrieving tags by plugins.
 * Used for getting all tags associated with specific plugins.
 */
export interface ITagsByPluginsQuery extends IBasePerTenantAndOrganizationEntityModel {
	/**
	 * Array of plugin IDs to filter by
	 */
	pluginIds: ID[];

	/**
	 * Include plugin information in the response
	 */
	includePlugins?: boolean;

	/**
	 * Include tag statistics (usage count, etc.)
	 */
	includeStatistics?: boolean;
}

/**
 * Input interface for bulk updating plugin-tag relationships.
 * Used when updating multiple plugin-tag relationships at once.
 */
export interface IPluginTagBulkUpdateInput {
	/**
	 * The ID of the plugin-tag relationship to update
	 */
	id: ID;

	/**
	 * The update data for the relationship
	 */
	data: IPluginTagUpdateInput;
}

/**
 * Input interface for updating plugin tags priority order.
 * Used when reordering plugin tags by priority.
 */
export interface IPluginTagPriorityUpdateInput {
	/**
	 * The ID of the plugin-tag relationship
	 */
	id: ID;

	/**
	 * The new priority order (lower numbers = higher priority)
	 */
	priority: number;
}

/**
 * Statistics interface for plugin-tag relationships.
 * Used for analytics and reporting.
 */
export interface IPluginTagStatistics {
	/**
	 * Total number of plugin-tag relationships
	 */
	totalRelationships: number;

	/**
	 * Number of unique plugins with tags
	 */
	taggedPlugins: number;

	/**
	 * Number of unique tags used in plugins
	 */
	usedTags: number;

	/**
	 * Most popular tags (tag ID and usage count)
	 */
	popularTags: Array<{
		tagId: ID;
		tagName: string;
		usageCount: number;
	}>;

	/**
	 * Plugins with most tags
	 */
	mostTaggedPlugins: Array<{
		pluginId: ID;
		pluginName: string;
		tagCount: number;
	}>;
}
