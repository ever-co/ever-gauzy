import { GetPluginQueryHandler } from './get-plugin-query.handler';
import { ListPluginVersionsQueryHandler } from './list-plugin-versions-query.handler';
import { ListPluginsQueryHandler } from './list-plugins-query.handler';

export const queries = [GetPluginQueryHandler, ListPluginsQueryHandler, ListPluginVersionsQueryHandler];
