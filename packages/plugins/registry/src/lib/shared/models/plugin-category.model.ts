import type { ID, IPluginCategory as PluginCategoryModel } from '@gauzy/contracts';
import type { IPlugin } from './plugin.model';

/**
 * Plugin Category Domain Model
 * Represents a categorization system for plugins
 */
export interface IPluginCategory extends PluginCategoryModel {}

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
