import { ipcMain, IpcMainEvent } from 'electron';
import * as logger from 'electron-log';
import { PluginManager } from '../data-access/plugin-manager';
import { IPluginManager, PluginChannel, PluginHandlerChannel } from '../shared';

class ElectronPluginListener {
	private pluginManager: IPluginManager;

	constructor(pluginManager: IPluginManager) {
		this.pluginManager = pluginManager;
		this.removeAllListeners();
		this.removeAllHandlers();
	}

	public registerListeners(): void {
		const eventMap = {
			[PluginChannel.LOAD]: this.loadPlugins,
			[PluginChannel.INITIALIZE]: this.initializePlugins,
			[PluginChannel.DISPOSE]: this.disposePlugins,
			[PluginChannel.DOWNLOAD]: this.downloadPlugin,
			[PluginChannel.ACTIVATE]: this.activatePlugin,
			[PluginChannel.DEACTIVATE]: this.deactivatePlugin,
			[PluginChannel.UNINSTALL]: this.uninstallPlugin
		};

		for (const [channel, handler] of Object.entries(eventMap)) {
			ipcMain.on(channel, this.handleEvent(handler));
		}
	}

	public registerHandlers(): void {
		ipcMain.handle(PluginHandlerChannel.GET_ALL, async () => {
			try {
				const plugins = await this.pluginManager.getAllPlugins();
				return plugins;
			} catch (error) {
				logger.error(error);
				return [];
			}
		});
		ipcMain.handle(PluginHandlerChannel.GET_ONE, (_, name) => {
			try {
				const plugin = this.pluginManager.getOnePlugin(name);
				return plugin;
			} catch (error) {
				logger.error(error);
				return null;
			}
		});
	}

	private removeAllListeners(): void {
		Object.values(PluginChannel).forEach((channel) => ipcMain.removeAllListeners(channel));
	}

	private removeAllHandlers(): void {
		Object.values(PluginHandlerChannel).forEach((channel) => ipcMain.removeHandler(channel));
	}

	private handleEvent(handler: (event: IpcMainEvent, ...args: any[]) => Promise<void> | void) {
		return async (event: IpcMainEvent, ...args: any[]) => {
			try {
				await handler.call(this, event, ...args);
				event.reply(PluginChannel.STATUS, { status: 'success' });
			} catch (error: any) {
				logger.error('Error handling event:', error);
				event.reply(PluginChannel.STATUS, { status: 'error', message: error?.message ?? String(error) });
			}
		};
	}

	private async loadPlugins(event: IpcMainEvent): Promise<void> {
		await this.pluginManager.loadPlugins();
	}

	private initializePlugins(event: IpcMainEvent): void {
		this.pluginManager.initializePlugins();
	}

	private disposePlugins(event: IpcMainEvent): void {
		this.pluginManager.disposePlugins();
	}

	private async downloadPlugin(event: IpcMainEvent, config: any): Promise<void> {
		await this.pluginManager.downloadPlugin(config);
	}

	private async activatePlugin(event: IpcMainEvent, name: string): Promise<void> {
		await this.pluginManager.activatePlugin(name);
	}

	private async deactivatePlugin(event: IpcMainEvent, name: string): Promise<void> {
		await this.pluginManager.deactivatePlugin(name);
	}

	private async uninstallPlugin(event: IpcMainEvent, name: string): Promise<void> {
		await this.pluginManager.uninstallPlugin(name);
	}
}

export function pluginListeners(): void {
	const pluginManager: IPluginManager = new PluginManager();
	const listener = new ElectronPluginListener(pluginManager);
	listener.registerListeners();
	listener.registerHandlers();
}
