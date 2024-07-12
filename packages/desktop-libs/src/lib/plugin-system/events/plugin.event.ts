import { ipcMain, IpcMainEvent } from 'electron';
import * as logger from 'electron-log';
import { PluginManager } from '../data-access/plugin-manager';
import { IPlugin, IPluginManager, IPluginMetadata, PluginChannel, PluginHandlerChannel } from '../shared';

class ElectronPluginListener {
	private pluginManager: IPluginManager;

	constructor(pluginManager: IPluginManager) {
		this.pluginManager = pluginManager;
		this.removeAllListeners();
		this.removeAllHandler();
	}

	public registerListeners(): void {
		ipcMain.on(PluginChannel.LOAD, this.handleEvent(this.loadPlugins));
		ipcMain.on(PluginChannel.INITIALIZE, this.handleEvent(this.initializePlugins));
		ipcMain.on(PluginChannel.DISPOSE, this.handleEvent(this.disposePlugins));
		ipcMain.on(PluginChannel.DOWNLOAD, this.handleEvent(this.downloadPlugin));
		ipcMain.on(PluginChannel.ACTIVATE, this.handleEvent(this.activatePlugin));
		ipcMain.on(PluginChannel.DEACTIVATE, this.handleEvent(this.deactivatePlugin));
		ipcMain.on(PluginChannel.UNINSTALL, this.handleEvent(this.uninstallPlugin));
	}

	public registerHandlers(): void {
		ipcMain.handle(PluginHandlerChannel.GET_ALL, this.getAll);
		ipcMain.handle(PluginHandlerChannel.GET_ONE, this.getOne);
	}

	private removeAllListeners(): void {
		const channels = Object.values(PluginChannel);
		channels.forEach((channel) => {
			ipcMain.removeAllListeners(channel);
		});
	}

	private removeAllHandler(): void {
		const channels = Object.values(PluginHandlerChannel);
		channels.forEach((channel) => {
			ipcMain.removeHandler(channel);
		});
	}

	private handleEvent(handler: (event: IpcMainEvent, ...args: any[]) => Promise<void> | void) {
		return async (event: IpcMainEvent, ...args: any[]) => {
			try {
				await handler.call(this, event, ...args);
				event.reply(PluginChannel.STATUS, { status: 'success' });
			} catch (error: any) {
				logger.error('Error handling event:', error);
				event.reply(PluginChannel.STATUS, { status: 'error', message: error?.message ?? error });
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

	private getAll(): Promise<IPluginMetadata[]> {
		return this.pluginManager.getAllPlugins();
	}

	private getOne(_: Electron.IpcMainInvokeEvent, name: string): IPlugin {
		return this.pluginManager.getOnePlugin(name);
	}
}

export function pluginListeners(): void {
	const pluginManager: IPluginManager = new PluginManager();
	const listener = new ElectronPluginListener(pluginManager);
	listener.registerListeners();
}
