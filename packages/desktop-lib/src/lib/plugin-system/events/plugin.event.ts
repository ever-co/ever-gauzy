import { logger } from '@gauzy/desktop-core';
import { ipcMain, IpcMainEvent } from 'electron';
import * as path from 'path';
import { PluginManager } from '../data-access/plugin-manager';
import { IPluginManager, PluginChannel, PluginHandlerChannel } from '../shared';
import { PluginEventManager } from './plugin-event.manager';

class ElectronPluginListener {
	private pluginManager: IPluginManager;
	private eventManager = PluginEventManager.getInstance();

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
		ipcMain.handle(PluginHandlerChannel.GET_ONE, async (_, name) => {
			try {
				const plugin = await this.pluginManager.getOnePlugin(name);
				return plugin;
			} catch (error) {
				logger.error(error);
				return null;
			}
		});

		ipcMain.handle(PluginHandlerChannel.LAZY_LOADER, async (_, pathname) => {
			try {
				// Ensure the plugin path is absolute
				const absolutePath = path.resolve(pathname); // Ensure the path is absolute

				console.log('Loading plugin from:', absolutePath);

				// Dynamically import the plugin module using the absolute file URL
				const pluginModule = await import(absolutePath);

				if (!pluginModule || Object.keys(pluginModule).length === 0) {
					throw new Error(`Loaded module from '${pathname}' is empty or undefined.`);
				}

				return pluginModule;
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
				this.eventManager.notify();
			} catch (error: any) {
				logger.error('Error handling event:', error);
				event.reply(PluginChannel.STATUS, { status: 'error', message: error?.message ?? String(error) });
			}
		};
	}

	private async loadPlugins(event: IpcMainEvent): Promise<void> {
		event.reply(PluginChannel.STATUS, { status: 'inProgress', message: 'Plugins loading...' });
		await this.pluginManager.loadPlugins();
		event.reply(PluginChannel.STATUS, { status: 'success', message: 'Plugins loaded' });
	}

	private initializePlugins(event: IpcMainEvent): void {
		event.reply(PluginChannel.STATUS, { status: 'inProgress', message: 'Plugins initializing' });
		this.pluginManager.initializePlugins();
		event.reply(PluginChannel.STATUS, { status: 'success', message: 'Plugins initialized' });
	}

	private disposePlugins(event: IpcMainEvent): void {
		event.reply(PluginChannel.STATUS, { status: 'inProgress', message: 'Plugins Disposing...' });
		this.pluginManager.disposePlugins();
		event.reply(PluginChannel.STATUS, { status: 'success', message: 'Plugins Disposed' });
	}

	private async downloadPlugin(event: IpcMainEvent, config: any): Promise<void> {
		event.reply(PluginChannel.STATUS, { status: 'inProgress', message: 'Plugin Downloading...' });
		await this.pluginManager.downloadPlugin(config);
		event.reply(PluginChannel.STATUS, { status: 'success', message: 'Plugin Downloaded' });
	}

	private async activatePlugin(event: IpcMainEvent, name: string): Promise<void> {
		event.reply(PluginChannel.STATUS, { status: 'inProgress', message: 'Plugin Activating...' });
		await this.pluginManager.activatePlugin(name);
		event.reply(PluginChannel.STATUS, { status: 'success', message: 'Plugin Activated' });
	}

	private async deactivatePlugin(event: IpcMainEvent, name: string): Promise<void> {
		event.reply(PluginChannel.STATUS, { status: 'inProgress', message: 'Plugin Deactivating...' });
		await this.pluginManager.deactivatePlugin(name);
		event.reply(PluginChannel.STATUS, { status: 'success', message: 'Plugin Deactivated' });
	}

	private async uninstallPlugin(event: IpcMainEvent, name: string): Promise<void> {
		event.reply(PluginChannel.STATUS, { status: 'inProgress', message: 'Plugin Uninstalling...' });
		await this.pluginManager.uninstallPlugin(name);
		event.reply(PluginChannel.STATUS, { status: 'success', message: 'Plugin Uninstalled' });
	}
}

export async function pluginListeners(): Promise<void> {
	const pluginManager: IPluginManager = PluginManager.getInstance();
	const listener = new ElectronPluginListener(pluginManager);
	listener.registerListeners();
	listener.registerHandlers();
	await pluginManager.loadPlugins();
}
