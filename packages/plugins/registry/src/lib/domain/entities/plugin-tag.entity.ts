import { isBetterSqlite3 } from '@gauzy/config';
import { ID, ITag } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	Tag,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { Index, JoinColumn, Relation, RelationId } from 'typeorm';
import { IPlugin, IPluginTag } from '../../shared/models';
import { Plugin } from './plugin.entity';

/**
 * PluginTag Entity
 *
 * Represents the many-to-many relationship between plugins and tags.
 * This entity allows plugins to be categorized and organized using a flexible tagging system.
 *
 * Business Logic:
 * - A plugin can have multiple tags
 * - A tag can be associated with multiple plugins
 * - Tags help in plugin discovery, categorization, and filtering
 * - Supports tenant and organization-level isolation
 * - Maintains referential integrity with cascade delete operations
 *
 * Use Cases:
 * - Plugin marketplace filtering and search
 * - Plugin categorization and organization
 * - Plugin recommendation systems
 * - Analytics and reporting on plugin usage patterns
 */
@MultiORMEntity('plugin_tags')
@Index(['pluginId', 'tagId'], { unique: true })
@Index(['pluginId', 'tenantId', 'organizationId'])
@Index(['tagId', 'tenantId', 'organizationId'])
export class PluginTag extends TenantOrganizationBaseEntity implements IPluginTag {
	/*
	|--------------------------------------------------------------------------
	| @ManyToOne Relations
	|--------------------------------------------------------------------------
	*/

	/**
	 * Plugin relationship
	 * Represents the plugin that is being tagged
	 */
	@ApiProperty({
		type: () => Plugin,
		description: 'The plugin associated with this tag relationship'
	})
	@MultiORMManyToOne(() => Plugin, (plugin) => plugin.pluginTags, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	plugin: Relation<IPlugin>;

	/**
	 * Plugin ID - Foreign key reference to the plugin
	 */
	@ApiProperty({
		type: String,
		description: 'ID reference to the plugin',
		format: 'uuid'
	})
	@IsNotEmpty({ message: 'Plugin ID is required' })
	@IsUUID(4, { message: 'Plugin ID must be a valid UUID' })
	@RelationId((pluginTag: PluginTag) => pluginTag.plugin)
	@ColumnIndex()
	@MultiORMColumn({ nullable: false, relationId: true })
	pluginId: ID;

	/**
	 * Tag relationship
	 * Represents the tag that is being applied to the plugin
	 */
	@ApiProperty({
		type: () => Tag,
		description: 'The tag associated with this plugin relationship'
	})
	@MultiORMManyToOne(() => Tag, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	tag: Relation<ITag>;

	/**
	 * Tag ID - Foreign key reference to the tag
	 */
	@ApiProperty({
		type: String,
		description: 'ID reference to the tag',
		format: 'uuid'
	})
	@IsNotEmpty({ message: 'Tag ID is required' })
	@IsUUID(4, { message: 'Tag ID must be a valid UUID' })
	@RelationId((pluginTag: PluginTag) => pluginTag.tag)
	@ColumnIndex()
	@MultiORMColumn({ nullable: false, relationId: true })
	tagId: ID;

	/*
	|--------------------------------------------------------------------------
	| Additional Properties for Business Logic
	|--------------------------------------------------------------------------
	*/

	/**
	 * Applied date - When the tag was applied to the plugin
	 * Useful for tracking and auditing purposes
	 */
	@ApiPropertyOptional({
		type: Date,
		description: 'Date when the tag was applied to the plugin'
	})
	@IsOptional()
	@MultiORMColumn({
		type: isBetterSqlite3() ? 'text' : 'timestamp',
		nullable: true,
		default: () => 'CURRENT_TIMESTAMP'
	})
	appliedAt?: Date;

	/**
	 * Applied by - User who applied the tag to the plugin
	 * Optional field for tracking who made the tag association
	 */
	@ApiPropertyOptional({
		type: String,
		description: 'ID of the user who applied the tag',
		format: 'uuid'
	})
	@IsOptional()
	@IsUUID(4, { message: 'Applied by must be a valid UUID' })
	@MultiORMColumn({ type: 'uuid', nullable: true })
	appliedById?: ID;

	/**
	 * Priority/Weight - Optional priority or weight for this tag association
	 * Can be used for sorting, relevance scoring, or featured tags
	 */
	@ApiPropertyOptional({
		type: Number,
		description: 'Priority or weight of this tag association (higher values = higher priority)',
		minimum: 0,
		maximum: 100,
		default: 50
	})
	@IsOptional()
	@MultiORMColumn({
		type: 'integer',
		nullable: true,
		default: 50,
		comment: 'Priority weight for tag association (0-100, higher = more important)'
	})
	priority?: number;

	/**
	 * Is featured - Whether this tag association should be featured/highlighted
	 * Useful for promoting certain plugins with specific tags
	 */
	@ApiPropertyOptional({
		type: Boolean,
		description: 'Whether this tag association is featured',
		default: false
	})
	@IsOptional()
	@MultiORMColumn({
		type: 'boolean',
		default: false,
		comment: 'Indicates if this tag association should be featured/highlighted'
	})
	isFeatured?: boolean;
}
