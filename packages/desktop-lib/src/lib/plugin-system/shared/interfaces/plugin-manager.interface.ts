import { ID } from '@gauzy/contracts';
import { MenuItemConstructorOptions } from 'electron';
import { IPluginMetadata, IPluginMetadataFindOne } from './plugin-metadata.interface';

export interface IPluginManager {
	loadPlugins(): Promise<void>;
	initializePlugins(): Promise<void>;
	disposePlugins(): Promise<void>;
	downloadPlugin(config: any): Promise<IPluginMetadata>;
	activatePlugin(name: string): Promise<void>;
	deactivatePlugin(name: string): Promise<void>;
	completeInstallation(marketplaceId: string, installationId: string): Promise<void>;
	uninstallPlugin(input: IPluginMetadataFindOne): Promise<ID>;
	getAllPlugins(): Promise<IPluginMetadata[]>;
	getOnePlugin(name: string): Promise<IPluginMetadata>;
	getMenuPlugins(): MenuItemConstructorOptions[];
	checkInstallation(marketplaceId: ID): Promise<IPluginMetadata>;
}
