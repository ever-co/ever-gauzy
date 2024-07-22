export interface IPluginMetadata {
	name: string;
	version: string;
	main: string;
	renderer?: string;
	description?: string;
	author?: string;
}

export type IPluginMetadataCreate = IPluginMetadata & {
	isActivate?: boolean;
	pathname: string;
};

export type IPluginMetadataUpdate = Partial<
	Pick<IPluginMetadataCreate, 'isActivate' | 'name' | 'version'> & { id?: string }
>;

export type IPluginMetadataPersistance = IPluginMetadataCreate & IPluginMetadataUpdate;

export type IPluginMetadataFindOne = Pick<IPluginMetadataUpdate, 'id' | 'name'>;

export type IPluginMetadataDelete = IPluginMetadataFindOne;
