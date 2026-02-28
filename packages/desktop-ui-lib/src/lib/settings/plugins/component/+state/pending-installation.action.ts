import { createAction } from '@ngneat/effects';
import { IPlugin } from '../../services/plugin-loader.service';
import { IPendingPluginInstallation } from './pending-installation.store';

/**
 * Actions for managing pending plugin installations
 */
export class PendingInstallationActions {
	/**
	 * Check for non-installed subscribed plugins
	 */
	public static readonly checkPendingInstallations = createAction(
		'[Pending Installation] Check Pending',
		(plugins: Array<IPlugin>) => ({ plugins })
	);

	/**
	 * Check and show dialog if there are pending plugins.
	 * This is useful when the PluginsModule is loaded and we want to show the dialog
	 * if the guard has already detected pending plugins.
	 */
	public static readonly checkAndShowDialog = createAction('[Pending Installation] Check And Show Dialog');

	/**
	 * Set the pending plugins list
	 */
	public static readonly setPendingPlugins = createAction(
		'[Pending Installation] Set Pending Plugins',
		(pendings: Array<IPendingPluginInstallation>, total: number) => ({ pendings, total })
	);

	/**
	 * Open the pending installation dialog
	 */
	public static readonly openDialog = createAction('[Pending Installation] Open Dialog');

	/**
	 * Close the pending installation dialog
	 */
	public static readonly closeDialog = createAction('[Pending Installation] Close Dialog');

	/**
	 * Enable or disable force install mode
	 * When enabled, auto-installable plugins are installed without user confirmation
	 */
	public static readonly setForceInstall = createAction(
		'[Pending Installation] Set Force Install',
		(enabled: boolean) => ({ enabled })
	);

	/**
	 * Install a single pending plugin
	 */
	public static readonly installPlugin = createAction(
		'[Pending Installation] Install Plugin',
		(pluginId: string, versionId: string) => ({ pluginId, versionId })
	);

	/**
	 * Install all pending plugins
	 */
	public static readonly installAllPlugins = createAction('[Pending Installation] Install All');

	/**
	 * Install only auto-installable plugins (respects canAutoInstall flag)
	 */
	public static readonly installAutoInstallablePlugins = createAction(
		'[Pending Installation] Install Auto-Installable'
	);

	/**
	 * Mark a plugin installation as started
	 */
	public static readonly installationStarted = createAction(
		'[Pending Installation] Installation Started',
		(pluginId: string) => ({ pluginId })
	);

	/**
	 * Mark a plugin installation as completed
	 */
	public static readonly installationCompleted = createAction(
		'[Pending Installation] Installation Completed',
		(pluginId: string) => ({ pluginId })
	);

	/**
	 * Mark a plugin installation as failed
	 */
	public static readonly installationFailed = createAction(
		'[Pending Installation] Installation Failed',
		(pluginId: string, error: string) => ({ pluginId, error })
	);

	/**
	 * Skip/dismiss a pending plugin
	 */
	public static readonly skipPlugin = createAction('[Pending Installation] Skip Plugin', (pluginId: string) => ({
		pluginId
	}));

	/**
	 * Skip all and close dialog
	 */
	public static readonly skipAll = createAction('[Pending Installation] Skip All');

	/**
	 * Reset the state
	 */
	public static readonly reset = createAction('[Pending Installation] Reset');

	/**
	 * Load more plugins (pagination)
	 */
	public static readonly loadMore = createAction('[Pending Installation] Load More Plugins');
}
