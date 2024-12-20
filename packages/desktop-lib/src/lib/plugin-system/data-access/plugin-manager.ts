import { app, MenuItemConstructorOptions } from 'electron';
import * as logger from 'electron-log';
import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PluginMetadataService } from '../database/plugin-metadata.service';
import { PluginEventManager } from '../events/plugin-event.manager';
import { IPlugin, IPluginManager, IPluginMetadata, PluginDownloadContextType } from '../shared';
import { lazyLoader } from '../shared/lazy-loader';
import { DownloadContextFactory } from './download-context.factory';

export class PluginManager implements IPluginManager {
	private plugins: Map<string, IPlugin> = new Map();
	private activePlugins: Set<IPlugin> = new Set();
	private pluginMetadataService = new PluginMetadataService();
	private pluginPath = path.join(app.getPath('userData'), 'plugins');
	private factory = DownloadContextFactory;
	private eventManager = PluginEventManager.getInstance();
	private static instance: IPluginManager;

	private constructor() {}

	public static getInstance(): IPluginManager {
		if (!this.instance) {
			this.instance = new PluginManager();
		}
		return this.instance;
	}

	public async downloadPlugin<U extends { contextType: PluginDownloadContextType }>(config: U): Promise<void> {
		logger.info(`Downloading plugin...`);
		process.noAsar = true;
		const context = this.factory.getContext(config.contextType);
		const { metadata, pathDirname } = await context.execute({ ...config, pluginPath: this.pluginPath });
		const plugin = this.plugins.get(metadata.name);
		if (plugin) {
			await this.updatePlugin(metadata);
		} else {
			/* Install plugin */
			await this.installPlugin(metadata, pathDirname);
			/* Activate plugin */
			await this.activatePlugin(metadata.name);
		}
		process.noAsar = false;
	}

	public async updatePlugin(pluginMetadata: IPluginMetadata): Promise<void> {
		logger.info(`Update plugin ${pluginMetadata.name}`);
		const persistance = await this.pluginMetadataService.findOne({ name: pluginMetadata.name });

		if (pluginMetadata.version === persistance.version) {
			logger.info(`Version is already update`);
			return;
		}

		if (persistance.isActivate) {
			this.deactivatePlugin(pluginMetadata.name);
		}
		const pluginPath = persistance.pathname;
		const backupPath = persistance.pathname + '-backup';
		await fs.rename(pluginPath, backupPath);

		if (!existsSync(pluginPath)) {
			await fs.mkdir(pluginPath, { recursive: true });
		}
		logger.info(`Updating plugin ${pluginMetadata.name}`);
		const plugin = await lazyLoader(path.join(pluginPath, pluginMetadata.main));
		this.plugins.set(pluginMetadata.name, plugin);

		await this.pluginMetadataService.update({
			name: pluginMetadata.name,
			version: pluginMetadata.version
		});

		if (persistance.isActivate) {
			this.activatePlugin(pluginMetadata.name);
		}
	}

	public async installPlugin(pluginMetadata: IPluginMetadata, pluginDir: string): Promise<void> {
		try {
			if (!pluginDir && !pluginMetadata) {
				const error = `An Error Occurred while Installing plugin`;
				logger.error(error);
				throw new Error(error);
			}
			logger.info(`Installing plugin ${pluginMetadata.name}`);
			const plugin = await lazyLoader(path.join(pluginDir, pluginMetadata.main));
			this.plugins.set(pluginMetadata.name, plugin);

			await this.pluginMetadataService.create({
				name: pluginMetadata.name,
				version: pluginMetadata.version,
				main: pluginMetadata.main,
				renderer: pluginMetadata.renderer,
				pathname: pluginDir
			});

			logger.info(`Plugin ${pluginMetadata.name} installed.`);
		} catch (error) {
			await fs.rm(pluginDir, { recursive: true, force: true, retryDelay: 1000, maxRetries: 3 });
			logger.error(error);
			throw new Error(error);
		}
	}

	public async activatePlugin(name: string): Promise<void> {
		const plugin = this.plugins.get(name);
		if (plugin) {
			await plugin.activate();
			this.activePlugins.add(plugin);
			await this.pluginMetadataService.update({ name, isActivate: true });
			await plugin.initialize();
		}
	}

	public async deactivatePlugin(name: string): Promise<void> {
		const plugin = this.plugins.get(name);
		if (plugin) {
			await plugin.dispose();
			await plugin.deactivate();
			this.activePlugins.delete(plugin);
			await this.pluginMetadataService.update({ name, isActivate: false });
		}
	}

	public async uninstallPlugin(name: string): Promise<void> {
		const metadata = await this.pluginMetadataService.findOne({ name });
		const plugin = this.plugins.get(name);
		if (plugin) {
			await this.deactivatePlugin(name);
			this.plugins.delete(name);
			await this.pluginMetadataService.delete({ name });
			await fs.rm(metadata.pathname, { recursive: true, force: true, retryDelay: 1000, maxRetries: 3 });
			logger.info(`Uninstalling plugin ${name}`);
		}
	}

	public async loadPlugins(): Promise<void> {
		logger.info('Loading plugins...');
		const pluginMetadatas = await this.pluginMetadataService.findAll();

		for (const metadata of pluginMetadatas) {
			const plugin = await lazyLoader(path.join(metadata.pathname, metadata.main));
			this.plugins.set(metadata.name, plugin);

			if (metadata.isActivate) {
				await this.activatePlugin(metadata.name);
			}
		}
		this.eventManager.notify();
	}

	public getAllPlugins(): Promise<IPluginMetadata[]> {
		return this.pluginMetadataService.findAll();
	}

	public getOnePlugin(name: string): Promise<IPluginMetadata> {
		return this.pluginMetadataService.findOne({ name });
	}

	public initializePlugins(): void {
		this.activePlugins.forEach(async (plugin) => await plugin.initialize());
	}

	public disposePlugins(): void {
		this.activePlugins.forEach(async (plugin) => await plugin.dispose());
	}

	public getMenuPlugins(): MenuItemConstructorOptions[] {
		try {
			const plugins = Array.from(this.activePlugins);
			logger.info('Active Plugins:', plugins);
			return plugins.map((plugin) => plugin?.menu).filter((menu): menu is MenuItemConstructorOptions => !!menu);
		} catch (error) {
			logger.error('Error retrieving plugin submenu:', error);
			return [];
		}
	}
}
