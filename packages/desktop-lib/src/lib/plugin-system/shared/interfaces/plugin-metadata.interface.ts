export interface IPluginMetadata {
	name: string;
	version: string;
	main: string;
	renderer?: string;
	description?: string;
	logo?: string;
	author?: string;
	marketplaceId?: string;
}

export type IPluginMetadataCreate = IPluginMetadata & {
	isActivate?: boolean;
	pathname: string;
};

export type IPluginMetadataUpdate = Partial<
	Pick<IPluginMetadataCreate, 'isActivate' | 'name' | 'version' | 'description' | 'logo' | 'marketplaceId'> & {
		id?: string;
	}
>;

export type IPluginMetadataPersistance = IPluginMetadataCreate & IPluginMetadataUpdate;

export type IPluginMetadataFindOne = Pick<IPluginMetadataUpdate, 'id' | 'name' | 'marketplaceId'>;

export type IPluginMetadataDelete = IPluginMetadataFindOne;
