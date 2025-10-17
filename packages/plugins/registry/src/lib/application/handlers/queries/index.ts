import { GetPluginQueryHandler } from './get-plugin-query.handler';
import { ListPluginVersionsQueryHandler } from './list-plugin-versions-query.handler';
import { ListPluginsQueryHandler } from './list-plugins-query.handler';
import { ListPluginSourcesQueryHandler } from './list-plugins-sources-query.handler';

// Plugin Category Query Handlers
import {
	GetPluginCategoriesHandler,
	GetPluginCategoryHandler,
	GetPluginCategoryTreeHandler
} from '../../../domain/handlers';

export const queries = [
	GetPluginQueryHandler,
	ListPluginsQueryHandler,
	ListPluginVersionsQueryHandler,
	ListPluginSourcesQueryHandler,
	// Plugin Category Handlers
	GetPluginCategoriesHandler,
	GetPluginCategoryHandler,
	GetPluginCategoryTreeHandler
];
