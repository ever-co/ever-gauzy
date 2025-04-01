import { createAction } from '@ngneat/effects';
import { IPlugin } from '../../../../services/plugin-loader.service';

export class PluginInstallationActions {
	public static install = createAction('[Plugin] Install', <T>(config: T) => ({ config }));
	public static uninstall = createAction('[Plugin] Uninstall', (plugin: IPlugin) => ({ plugin }));
	public static toggle = createAction('[Plugin] Toggle', (state: { current: boolean; plugin: IPlugin }) => state);
}
