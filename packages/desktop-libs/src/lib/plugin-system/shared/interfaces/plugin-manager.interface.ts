import { IPluginMetadata } from './plugin-metadata.interface';

export interface IPluginManager {
	loadPlugins(): Promise<void>;
	initializePlugins(): void;
	disposePlugins(): void;
	downloadPlugin(config: any): Promise<void>;
	activatePlugin(name: string): Promise<void>;
	deactivatePlugin(name: string): Promise<void>;
	uninstallPlugin(name: string): Promise<void>;
	getAllPlugins(): Promise<IPluginMetadata[]>;
	getOnePlugin(name: string): Promise<IPluginMetadata>;
}
