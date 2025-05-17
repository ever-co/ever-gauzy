import { ID, IPluginSource } from '@gauzy/contracts';
import { createAction } from '@ngneat/effects';

export class PluginSourceActions {
	public static getAll = createAction('[Plugin Source] Get All', <T>(pluginId: ID, versionId: ID, params?: T) => ({
		params,
		pluginId,
		versionId
	}));
	public static selectVersion = createAction('[Plugin Source] Select', (source: IPluginSource) => ({ source }));
	public static reset = createAction('[Plugin Source] Reset');
}
