export interface IPluginMetadata {
	name: string;
	version: string;
	main: string;
	description?: string;
	author?: string;
}

export type IPluginMetadataCreate = Pick<IPluginMetadata, 'name' | 'version' | 'main'> & {
	isActivate?: boolean;
	pathname: string;
};

export type IPluginMetadataUpdate = Partial<
	Pick<IPluginMetadataCreate, 'isActivate' | 'name' | 'version'> & { id?: string }
>;

export type IPluginMetadataPersistance = IPluginMetadataCreate & IPluginMetadataUpdate;

export type IPluginMetadataFindOne = Pick<IPluginMetadataUpdate, 'id' | 'name'>;

export type IPluginMetadataDelete = IPluginMetadataFindOne;
