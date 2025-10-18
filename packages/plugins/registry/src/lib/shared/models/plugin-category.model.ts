import type { IBasePerTenantAndOrganizationEntityModel, ID } from '@gauzy/contracts';
import type { IPlugin } from './plugin.model';
import type { IPluginSetting } from './plugin-setting.model';

/**
 * Plugin Category Domain Model
 * Represents a categorization system for plugins
 */
export interface IPluginCategory extends IBasePerTenantAndOrganizationEntityModel {
	// Category name (unique within tenant/organization)
	name: string;

	// Category description
	description?: string;

	// Category slug for URL-friendly identification
	slug: string;

	// Category color for UI representation
	color?: string;

	// Category icon identifier
	icon?: string;

	// Display order for sorting
	order: number;

	// Parent category for hierarchical structure
	parent?: IPluginCategory;

	parentId?: ID;

	// Child categories
	children?: IPluginCategory[];

	// Plugins in this category
	plugins?: IPlugin[];

	// Default settings for plugins in this category
	settings?: IPluginSetting[];

	// Category metadata (JSON object for flexibility)
	metadata?: Record<string, any>;
}

/**
 * Plugin Category Creation Input
 */
export interface IPluginCategoryCreateInput
	extends Omit<
		IPluginCategory,
		'id' | 'createdAt' | 'updatedAt' | 'parent' | 'children' | 'plugins' | 'defaultSettings'
	> {
	parentId?: ID;
}

/**
 * Plugin Category Update Input
 */
export interface IPluginCategoryUpdateInput extends Partial<IPluginCategoryCreateInput> {}

/**
 * Plugin Category Find Input
 */
export interface IPluginCategoryFindInput
	extends Partial<Pick<IPluginCategory, 'name' | 'slug' | 'isActive' | 'parentId'>> {}

/**
 * Plugin Category Tree Node
 * For hierarchical representation
 */
export interface IPluginCategoryTree extends IPluginCategory {
	level: number;
	path: string[];
	hasChildren: boolean;
	childCount: number;
	pluginCount: number;
}

/**
 * Plugin Category Statistics
 */
export interface IPluginCategoryStats {
	categoryId: ID;
	categoryName: string;
	pluginCount: number;
	activePluginCount: number;
	subscriptionCount: number;
	totalRevenue: number;
}

/**
 * Plugin Category with Plugins
 */
export interface IPluginCategoryWithPlugins extends IPluginCategory {
	plugins: IPlugin[];
	pluginCount: number;
}
