import { isMySQL, isPostgres } from '@gauzy/config';
import { ID } from '@gauzy/contracts';
import { MultiORMColumn, MultiORMEntity, MultiORMOneToMany, TenantOrganizationBaseEntity } from '@gauzy/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
	MaxLength,
	MinLength
} from 'class-validator';
import { JoinColumn, Relation, RelationId, Tree, TreeChildren, TreeParent } from 'typeorm';
import { IPluginCategory } from '../../shared/models/plugin-category.model';
import { IPluginSetting } from '../../shared/models/plugin-setting.model';
import { IPlugin } from '../../shared/models/plugin.model';
import { PluginSetting } from './plugin-setting.entity';
import { Plugin } from './plugin.entity';

@Tree('closure-table')
@MultiORMEntity('plugin_categories')
export class PluginCategory extends TenantOrganizationBaseEntity implements IPluginCategory {
	@ApiProperty({ type: String, description: 'Category name' })
	@IsNotEmpty({ message: 'Category name is required' })
	@IsString({ message: 'Category name must be a string' })
	@MinLength(2, { message: 'Category name must be at least 2 characters' })
	@MaxLength(100, { message: 'Category name must not exceed 100 characters' })
	@MultiORMColumn()
	name: string;

	@ApiPropertyOptional({ type: String, description: 'Category description' })
	@IsOptional()
	@IsString({ message: 'Description must be a string' })
	@MaxLength(500, { message: 'Description must not exceed 500 characters' })
	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string;

	@ApiProperty({ type: String, description: 'Category slug for URL-friendly identification' })
	@IsNotEmpty({ message: 'Category slug is required' })
	@IsString({ message: 'Slug must be a string' })
	@Matches(/^[a-z0-9-]+$/, { message: 'Slug must contain only lowercase letters, numbers, and hyphens' })
	@MinLength(2, { message: 'Slug must be at least 2 characters' })
	@MaxLength(100, { message: 'Slug must not exceed 100 characters' })
	@MultiORMColumn({ unique: true })
	slug: string;

	@ApiPropertyOptional({ type: String, description: 'Category color for UI representation' })
	@IsOptional()
	@IsString({ message: 'Color must be a string' })
	@Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: 'Color must be a valid hex color' })
	@MultiORMColumn({ nullable: true })
	color?: string;

	@ApiPropertyOptional({ type: String, description: 'Category icon identifier' })
	@IsOptional()
	@IsString({ message: 'Icon must be a string' })
	@MaxLength(50, { message: 'Icon identifier must not exceed 50 characters' })
	@MultiORMColumn({ nullable: true })
	icon?: string;

	@ApiProperty({ type: Number, description: 'Display order for sorting' })
	@IsNumber({}, { message: 'Order must be a number' })
	@MultiORMColumn({ type: 'int', default: 0 })
	order: number;

	@ApiPropertyOptional({ type: Object, description: 'Category metadata (JSON object)' })
	@IsOptional()
	@IsObject({ message: 'Metadata must be a valid JSON object' })
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	metadata?: Record<string, any>;

	/*
	 * Parent-Child Relationships for hierarchical structure
	 */
	@ApiPropertyOptional({ type: String, description: 'Parent category ID' })
	@IsOptional()
	@IsUUID()
	@RelationId((category: PluginCategory) => category.parent)
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	parentId?: ID;

	@ApiPropertyOptional({ type: () => PluginCategory, description: 'Parent category' })
	@TreeParent()
	@JoinColumn()
	parent?: Relation<IPluginCategory>;

	@ApiPropertyOptional({ type: () => [PluginCategory], description: 'Child categories' })
	@TreeChildren({ cascade: true })
	children?: Relation<IPluginCategory[]>;

	/*
	 * Plugin relationships
	 */
	@ApiPropertyOptional({ type: () => Array, description: 'Plugins in this category' })
	@MultiORMOneToMany(() => Plugin, (plugin) => plugin.category, {
		onDelete: 'SET NULL'
	})
	plugins?: Relation<IPlugin[]>;

	/*
	 * Default settings for plugins in this category
	 */
	@ApiPropertyOptional({ type: () => Array, description: 'Default settings for plugins in this category' })
	@MultiORMOneToMany(() => PluginSetting, (setting) => setting.category, {
		onDelete: 'CASCADE'
	})
	settings?: Relation<IPluginSetting[]>;

	/*
	 * Domain Methods
	 */

	/**
	 * Check if this category is a root category (has no parent)
	 */
	isRoot(): boolean {
		return !this.parentId;
	}

	/**
	 * Check if this category has children
	 */
	hasChildren(): boolean {
		return this.children && this.children.length > 0;
	}

	/**
	 * Check if this category can be deleted
	 */
	canBeDeleted(): boolean {
		return !this.hasChildren() && (!this.plugins || this.plugins.length === 0);
	}
}
