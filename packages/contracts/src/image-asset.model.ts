import { FileStorageProviderEnum } from "./file-provider";
import { IBasePerTenantAndOrganizationEntityModel } from "./base-entity.model";

export interface IImageAsset extends IImageAssetCreateInput {
	fullUrl?: string;
	thumbUrl?: string;
}

export interface IImageAssetFindInput extends IBasePerTenantAndOrganizationEntityModel, Pick<IImageAsset, 'isFeatured'> { }

export interface IImageAssetCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	url: string;
	thumb?: string;
	width?: number;
	height?: number;
	size?: number;
	isFeatured?: boolean;
	externalProviderId?: string;
	storageProvider?: FileStorageProviderEnum;
}
