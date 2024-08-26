import { app, MenuItemConstructorOptions } from 'electron';
import * as logger from 'electron-log';
import * as fs from 'fs';
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

	public async downloadPlugin<U>(config: U, contextType?: PluginDownloadContextType): Promise<void> {
		logger.info(`Downloading plugin...`);
		process.noAsar = true;
		const context = this.factory.getContext(contextType);
		const { metadata, pathDirname } = await context.execute(config);
		const plugin = this.plugins.get(metadata.name);
		if (plugin) {
			await this.updatePlugin(metadata);
		} else {
			await this.installPlugin(metadata, pathDirname);
		}
		fs.rmSync(pathDirname, { recursive: true, force: true, retryDelay: 1000, maxRetries: 3 });
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
		fs.renameSync(pluginPath, backupPath);

		if (!fs.existsSync(pluginPath)) {
			fs.mkdirSync(pluginPath, { recursive: true });
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

	public async installPlugin(pluginMetadata: IPluginMetadata, source: string): Promise<void> {
		const pluginDir = path.join(this.pluginPath, `${Date.now()}-${pluginMetadata.name}`);
		if (!fs.existsSync(pluginDir)) {
			fs.mkdirSync(pluginDir, { recursive: true });
		}
		if (source) {
			fs.cpSync(source, pluginDir, { recursive: true, force: true });
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
			fs.rmSync(metadata.pathname, { recursive: true, force: true, retryDelay: 1000, maxRetries: 3 });
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
