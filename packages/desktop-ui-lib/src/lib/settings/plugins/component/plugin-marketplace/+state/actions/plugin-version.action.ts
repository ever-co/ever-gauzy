import { ID, IPluginVersion } from '@gauzy/contracts';
import { createAction } from '@ngneat/effects';

export class PluginVersionActions {
	public static getAll = createAction('[Plugin Version] Get All', <T>(pluginId: ID, params?: T) => ({
		params,
		pluginId
	}));
	public static add = createAction('[Plugin Version] Add', (pluginId: ID, version: IPluginVersion) => ({
		pluginId,
		version
	}));
	public static update = createAction(
		'[Plugin] Update Version',
		(pluginId: ID, versionId: ID, version: IPluginVersion) => ({
			pluginId,
			versionId,
			version
		})
	);
	public static delete = createAction('[Plugin Version] Delete', (pluginId: ID, versionId: ID) => ({
		pluginId,
		versionId
	}));
	public static restore = createAction('[Plugin Version] Restore', (pluginId: ID, versionId: ID) => ({
		pluginId,
		versionId
	}));
	public static setCurrentPluginId = createAction('[Plugin Version] Set current plugin ID', (pluginId: ID) => ({
		pluginId
	}));
	public static selectVersion = createAction('[Plugin Version] Select', (version: IPluginVersion) => ({ version }));
	public static reset = createAction('[Plugin Version] Reset');
}
