import { IPlugin as IPluginMarketplace } from '@gauzy/contracts';
import { createAction } from '@ngneat/effects';
import { IPlugin } from '../../../../services/plugin-loader.service';

export class PluginInstallationActions {
	// Main actions
	public static install = createAction('[Plugin Installation] Install', <T>(config: T) => ({ config }));
	public static uninstall = createAction('[Plugin Installation] Uninstall', (plugin: IPlugin) => ({ plugin }));
	public static toggle = createAction(
		'[Plugin Installation] Toggle',
		(state: { isChecked?: boolean; plugin?: IPluginMarketplace }) => state
	);

	// Step 1: Download
	public static startDownload = createAction('[Plugin Installation] Start Download', <T>(config: T) => ({ config }));
	public static downloadCompleted = createAction(
		'[Plugin Installation] Download Completed',
		(plugin: IPlugin, message?: string) => ({ plugin, message })
	);
	public static downloadFailed = createAction('[Plugin Installation] Download Failed', (error: string) => ({
		error
	}));

	// Step 2: Server Installation
	public static startServerInstallation = createAction(
		'[Plugin Installation] Start Server Installation',
		(pluginId: string, versionId: string) => ({ pluginId, versionId })
	);
	public static serverInstallationCompleted = createAction(
		'[Plugin Installation] Server Installation Completed',
		(installationId: string, pluginId: string) => ({ installationId, pluginId })
	);
	public static serverInstallationFailed = createAction(
		'[Plugin Installation] Server Installation Failed',
		(error: string) => ({ error })
	);

	// Step 3: Complete Installation
	public static startCompleteInstallation = createAction(
		'[Plugin Installation] Start Complete Installation',
		(marketplaceId: string, installationId: string) => ({ marketplaceId, installationId })
	);
	public static installationCompleted = createAction(
		'[Plugin Installation] Installation Completed',
		(plugin: IPluginMarketplace) => ({ plugin })
	);
	public static installationFailed = createAction('[Plugin Installation] Installation Failed', (error: string) => ({
		error
	}));

	// Step 4: Activation
	public static startActivation = createAction(
		'[Plugin Installation] Start Activation',
		(installationId: string, marketplaceId: string) => ({ installationId, marketplaceId })
	);
	public static activationCompleted = createAction(
		'[Plugin Installation] Activation Completed',
		(plugin: IPlugin, message?: string) => ({ plugin, message })
	);
	public static activationFailed = createAction('[Plugin Installation] Activation Failed', (error: string) => ({
		error
	}));

	// Cleanup
	public static clearError = createAction('[Plugin Installation] Clear Error');
	public static reset = createAction('[Plugin Installation] Reset State');
}
