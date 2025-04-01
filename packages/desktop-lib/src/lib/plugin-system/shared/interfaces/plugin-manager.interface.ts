import { MenuItemConstructorOptions } from 'electron';
import { IPluginMetadata } from './plugin-metadata.interface';
import { ID } from '@gauzy/contracts';

export interface IPluginManager {
	loadPlugins(): Promise<void>;
	initializePlugins(): void;
	disposePlugins(): void;
	downloadPlugin(config: any): Promise<IPluginMetadata>;
	activatePlugin(name: string): Promise<void>;
	deactivatePlugin(name: string): Promise<void>;
	uninstallPlugin(name: string): Promise<void>;
	getAllPlugins(): Promise<IPluginMetadata[]>;
	getOnePlugin(name: string): Promise<IPluginMetadata>;
	getMenuPlugins(): MenuItemConstructorOptions[];
	checkInstallation(marketplaceId: ID): Promise<IPluginMetadata>;
}
