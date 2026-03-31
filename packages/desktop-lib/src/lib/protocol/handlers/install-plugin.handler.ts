import { AppWindowManager } from '../../app-window-manager';
import { AbstractProtocolHandler } from './abstract-protocol-handler';

/**
 * Handles the `gauzy://install-plugin` deep-link action.
 *
 * Expected query parameters:
 *  - `pluginId`      (required) — marketplace plugin identifier.
 *  - `versionId`     (optional) — specific version to install.
 *  - `forceInstall`  (optional, `"true"` | `"false"`) — skip confirmation.
 *
 * Design principles:
 *  - Single Responsibility (SOLID-S): this class only handles plugin
 *    installation deep links; nothing else.
 *  - Liskov Substitution  (SOLID-L): safely substitutable wherever an
 *    `IProtocolHandler` or `AbstractProtocolHandler` is expected.
 */
export class InstallPluginHandler extends AbstractProtocolHandler {
	readonly action = 'install-plugin';

	/**
	 * @param timeTrackerUi Absolute path to the renderer HTML file, forwarded
	 *                      to the window factory on first creation.
	 */
	constructor(private readonly timeTrackerUi: string) {
		super();
	}

	/** @inheritdoc */
	async handle(url: URL): Promise<void> {
		const pluginId = url.searchParams.get('pluginId');
		const versionId = url.searchParams.get('versionId');
		const forceInstall = url.searchParams.get('forceInstall') === 'true';

		if (!pluginId) {
			this.log.error('[InstallPluginHandler] Missing required "pluginId" query parameter');
			return;
		}

		this.log.info('[InstallPluginHandler] Plugin installation requested:', { pluginId, versionId, forceInstall });

		const manager = AppWindowManager.getInstance();
		const pluginWindow = await manager.initPluginsWindow(this.timeTrackerUi);

		if (pluginWindow.isDestroyed()) {
			throw new Error('[InstallPluginHandler] Plugin window was destroyed before the IPC message could be sent');
		}

		pluginWindow.show();

		pluginWindow.browserWindow.webContents.send('deep-link-install-plugin', {
			pluginId,
			versionId,
			forceInstall
		});
	}
}
