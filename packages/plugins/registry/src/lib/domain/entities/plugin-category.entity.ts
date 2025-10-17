import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	IsNumber,
	Matches,
	MaxLength,
	MinLength
} from 'class-validator';
import { JoinColumn, Relation, RelationId, Tree, TreeParent, TreeChildren } from 'typeorm';
import {
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { IPluginCategory } from '../../shared/models/plugin-category.model';
import { IPlugin } from '../../shared/models/plugin.model';
import { IPluginSetting } from '../../shared/models/plugin-setting.model';

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

	@ApiProperty({ type: Boolean, description: 'Whether the category is active' })
	@IsBoolean({ message: 'isActive must be a boolean' })
	@MultiORMColumn({ type: 'boolean', default: true })
	isActive: boolean;

	@ApiPropertyOptional({ type: String, description: 'Category metadata (JSON string)' })
	@IsOptional()
	@IsString({ message: 'Metadata must be a string' })
	@MultiORMColumn({ type: 'text', nullable: true })
	metadata?: string;

	/*
	 * Parent-Child Relationships for hierarchical structure
	 */
	@ApiPropertyOptional({ type: String, description: 'Parent category ID' })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	@RelationId((category: PluginCategory) => category.parent)
	parentId?: string;

	@TreeParent()
	@MultiORMManyToOne(() => PluginCategory, (category) => category.children, {
		onDelete: 'SET NULL',
		nullable: true
	})
	@JoinColumn()
	parent?: Relation<IPluginCategory>;

	@TreeChildren()
	@MultiORMOneToMany(() => PluginCategory, (category) => category.parent)
	children?: Relation<IPluginCategory[]>;

	/*
	 * Plugin relationships
	 */
	@ApiPropertyOptional({ type: () => Array, description: 'Plugins in this category' })
	@MultiORMOneToMany('Plugin', 'category', {
		onDelete: 'SET NULL'
	})
	plugins?: IPlugin[];

	/*
	 * Default settings for plugins in this category
	 */
	@ApiPropertyOptional({ type: () => Array, description: 'Default settings for plugins in this category' })
	@MultiORMOneToMany('PluginSetting', 'category', {
		onDelete: 'CASCADE'
	})
	defaultSettings?: IPluginSetting[];

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
	 * Get the full path of category names from root to this category
	 */
	getPath(): string[] {
		const path: string[] = [];
		let current: IPluginCategory = this;

		while (current) {
			path.unshift(current.name);
			current = current.parent;
		}

		return path;
	}

	/**
	 * Generate a display name with full path
	 */
	getDisplayName(): string {
		return this.getPath().join(' > ');
	}

	/**
	 * Check if this category can be deleted
	 */
	canBeDeleted(): boolean {
		return !this.hasChildren() && (!this.plugins || this.plugins.length === 0);
	}

	/**
	 * Validate category hierarchy (prevent circular references)
	 */
	validateHierarchy(newParentId?: string): boolean {
		if (!newParentId) return true;

		// Can't be parent of itself
		if (newParentId === this.id) return false;

		// Can't be parent of its children (circular reference check)
		const checkCircular = (category: IPluginCategory, targetId: string): boolean => {
			if (category.id === targetId) return true;
			if (category.children) {
				return category.children.some((child) => checkCircular(child, targetId));
			}
			return false;
		};

		return !checkCircular(this, newParentId);
	}
}
