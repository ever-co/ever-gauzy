import { app } from 'electron';
import * as logger from 'electron-log';
import * as fs from 'fs';
import * as path from 'path';
import { PluginMetadataService } from '../database/plugin-metadata.service';
import { IPlugin, IPluginManager, IPluginMetadata, PluginDownloadContextType } from '../shared';
import { lazyLoader } from '../shared/lazy-loader';
import { DownloadContextFactory } from './download-context.factory';

export class PluginManager implements IPluginManager {
	private plugins: Map<string, IPlugin> = new Map();
	private activePlugins: Set<string> = new Set();
	private pluginMetadataService = new PluginMetadataService();
	private pluginPath = path.join(app.getPath('userData'), 'plugins');
	private factory = DownloadContextFactory;

	public async downloadPlugin<U>(config: U, contextType?: PluginDownloadContextType): Promise<void> {
		logger.info(`Downloading plugin...`);
		const context = this.factory.getContext(contextType);
		const { metadata, pathDirname } = await context.execute(config);
		const plugin = this.plugins.get(metadata.name);
		if (plugin) {
			await this.updatePlugin(metadata);
		} else {
			await this.installPlugin(metadata, pathDirname);
		}
		fs.rmdirSync(pathDirname, { recursive: true });
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
			fs.cpSync(source, pluginDir, { recursive: true });
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
			plugin.activate();
			this.activePlugins.add(name);
			await this.pluginMetadataService.update({ name, isActivate: true });
			plugin.initialize();
		}
	}

	public async deactivatePlugin(name: string): Promise<void> {
		const plugin = this.plugins.get(name);
		if (plugin) {
			plugin.dispose();
			plugin.deactivate();
			this.activePlugins.delete(name);
			await this.pluginMetadataService.update({ name: name, isActivate: false });
		}
	}

	public async uninstallPlugin(name: string): Promise<void> {
		const metadata = await this.pluginMetadataService.findOne({ name: name });
		const plugin = this.plugins.get(name);
		if (plugin) {
			await this.deactivatePlugin(name);
			plugin.dispose();
			this.plugins.delete(name);
			this.activePlugins.delete(name);
			fs.unlinkSync(metadata.pathname);
			logger.info(`Uninstalling plugin ${name}`);
			await this.pluginMetadataService.delete({ name });
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
	}

	public getAllPlugins(): Promise<IPluginMetadata[]> {
		return this.pluginMetadataService.findAll();
	}

	public getOnePlugin(name: string): Promise<IPluginMetadata> {
		return this.pluginMetadataService.findOne({ name });
	}

	public initializePlugins(): void {
		this.plugins.forEach((plugin) => plugin.initialize());
	}

	public disposePlugins(): void {
		this.plugins.forEach((plugin) => plugin.dispose());
	}
}
