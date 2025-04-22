import { createAction } from '@ngneat/effects';
import { IPlugin } from '../../services/plugin-loader.service';

export class PluginActions {
	public static getPlugins = createAction('[Plugin Installed] Get All');
	public static getPlugin = createAction('[Plugin Installed] Get One', (name: string) => ({ name }));
	public static selectPlugin = createAction('[Plugin Installed] Select', (plugin: IPlugin) => ({ plugin }));
	public static activate = createAction('[Plugin Installed] Activate', (plugin: IPlugin) => ({ plugin }));
	public static deactivate = createAction('[Plugin Installed] Deactivate', (plugin: IPlugin) => ({ plugin }));
	public static refresh = createAction('[Plugin Installed] Refresh');
}
