import { ID, IPluginVersion } from '@gauzy/contracts';
import { createAction } from '@ngneat/effects';

export class PluginVersionActions {
	public static getAll = createAction('[Plugin] Get Version', <T>(pluginId: ID, params?: T) => ({
		params,
		pluginId
	}));
	public static add = createAction('[Plugin] Add Versions', (pluginId: ID, version: IPluginVersion) => ({
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
	public static delete = createAction('[Plugin] Delete Version', (pluginId: ID, versionId: ID) => ({
		pluginId,
		versionId
	}));
	public static restore = createAction('[Plugin] Restore Version', (pluginId: ID, versionId: ID) => ({
		pluginId,
		versionId
	}));
	public static setCurrentPluginId = createAction('[Plugin] Set current plugin ID', (pluginId: ID) => ({ pluginId }));
	public static selectVersion = createAction('[Plugin] Select Version', (version: IPluginVersion) => ({ version }));
}
