import { IPlugin as IPluginMarketplace } from '@gauzy/contracts';
import { createAction } from '@ngneat/effects';
import { IPlugin } from '../../../../services/plugin-loader.service';

export class PluginInstallationActions {
	public static install = createAction('[Plugin Installation] Install', <T>(config: T) => ({ config }));
	public static uninstall = createAction('[Plugin Installation] Uninstall', (plugin: IPlugin) => ({ plugin }));
	public static toggle = createAction(
		'[Plugin Installation] Toggle',
		(state: { isChecked?: boolean; plugin?: IPluginMarketplace }) => state
	);
}
