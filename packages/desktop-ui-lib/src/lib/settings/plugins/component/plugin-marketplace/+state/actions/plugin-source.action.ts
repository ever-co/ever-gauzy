import { ID, IPluginSource } from '@gauzy/contracts';
import { createAction } from '@ngneat/effects';

export class PluginSourceActions {
	public static add = createAction(
		'[Plugin Source] Add',
		(pluginId: ID, versionId: ID, sources: IPluginSource[]) => ({
			pluginId,
			versionId,
			sources
		})
	);
	public static getAll = createAction('[Plugin Source] Get All', <T>(pluginId: ID, versionId: ID, params?: T) => ({
		params,
		pluginId,
		versionId
	}));
	public static delete = createAction('[Plugin Source] Delete', (pluginId: ID, versionId: ID, sourceId: ID) => ({
		pluginId,
		versionId,
		sourceId
	}));
	public static restore = createAction('[Plugin Source] Restore', (pluginId: ID, versionId: ID, sourceId: ID) => ({
		pluginId,
		versionId,
		sourceId
	}));
	public static selectSource = createAction('[Plugin Source] Select', (source: IPluginSource) => ({ source }));
	public static reset = createAction('[Plugin Source] Reset');
}
