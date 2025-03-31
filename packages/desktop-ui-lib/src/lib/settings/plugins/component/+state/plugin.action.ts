import { createAction } from '@ngneat/effects';
import { IPlugin } from '../../services/plugin-loader.service';

export class PluginActions {
	public static getPlugins = createAction('[Plugin] Get All');
	public static getPlugin = createAction('[Plugin] Get One', (name: string) => ({ name }));
	public static selectPlugin = createAction('[Plugin] Select', (plugin: IPlugin) => ({ plugin }));
	public static activate = createAction('[Plugin] Activate', (plugin: IPlugin) => ({ plugin }));
	public static deactivate = createAction('[Plugin] Deactivate', (plugin: IPlugin) => ({ plugin }));
	public static install = createAction('[Plugin] Install', <T>(config: T) => ({ config }));
	public static uninstall = createAction('[Plugin] Uninstall', (plugin: IPlugin) => ({ plugin }));
	public static refresh = createAction('[Plugin] Refresh');
}
