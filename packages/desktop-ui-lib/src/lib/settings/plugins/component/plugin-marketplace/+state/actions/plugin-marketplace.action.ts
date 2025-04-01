import { ID, IPlugin } from '@gauzy/contracts';
import { createAction } from '@ngneat/effects';

export class PluginMarketplaceActions {
	public static upload = createAction('[Plugin] Upload', (plugin: IPlugin) => ({ plugin }));
	public static getAll = createAction('[Plugin] Get All', <T>(params?: T) => ({ params }));
	public static getOne = createAction('[Plugin] Get One', <T>(id: ID, params?: T) => ({ id, params }));
	public static update = createAction('[Plugin] Update', (id: ID, plugin: Partial<IPlugin>) => ({
		id,
		plugin
	}));
	public static delete = createAction('[Plugin] Delete', (id: ID) => ({ id }));
}
