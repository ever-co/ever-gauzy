import { ID, IPlugin } from '@gauzy/contracts';
import { createAction } from '@ngneat/effects';

export class PluginMarketplaceActions {
	public static upload = createAction('[Plugin Marketplace] Upload', (plugin: IPlugin) => ({ plugin }));
	public static getAll = createAction('[Plugin Marketplace] Get All', <T>(params?: T) => ({ params }));
	public static getOne = createAction('[Plugin Marketplace] Get One', <T>(id: ID, params?: T) => ({ id, params }));
	public static update = createAction('[Plugin Marketplace] Update', (id: ID, plugin: Partial<IPlugin>) => ({
		id,
		plugin
	}));
	public static delete = createAction('[Plugin Marketplace] Delete', (id: ID) => ({ id }));
	public static reset = createAction('[Plugin Marketplace] Reset');
}
