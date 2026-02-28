import { createAction } from '@ngneat/effects';
import { IPlugin } from '../../services/plugin-loader.service';

export class PluginActions {
	public static readonly getPlugins = createAction('[Plugin Installed] Get All');
	public static readonly getPluginsSuccess = createAction(
		'[Plugin Installed] Get All Success',
		(plugins: IPlugin[]) => ({ plugins })
	);
	public static readonly getPlugin = createAction('[Plugin Installed] Get One', (name: string) => ({ name }));
	public static readonly selectPlugin = createAction('[Plugin Installed] Select', (plugin: IPlugin) => ({ plugin }));
	public static readonly activate = createAction('[Plugin Installed] Activate', (plugin: IPlugin) => ({ plugin }));
	public static readonly deactivate = createAction('[Plugin Installed] Deactivate', (plugin: IPlugin) => ({
		plugin
	}));
	public static readonly refresh = createAction('[Plugin Installed] Refresh');
}
