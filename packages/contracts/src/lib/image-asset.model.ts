import { FileStorageProvider } from './file-provider';
import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

export interface IRelationalImageAsset {
	image?: IImageAsset | null;
	imageId?: ID | null;
}

export interface IImageAsset extends IImageAssetCreateInput {
	fullUrl?: string;
	thumbUrl?: string;
}

export interface IImageAssetFindInput
	extends IBasePerTenantAndOrganizationEntityModel,
		Pick<IImageAsset, 'isFeatured'> {}

export interface IImageAssetUploadInput extends IBasePerTenantAndOrganizationEntityModel {}

export interface IImageAssetCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	url: string;
	thumb?: string;
	width?: number;
	height?: number;
	size?: number;
	isFeatured?: boolean;
	externalProviderId?: string;
	storageProvider?: FileStorageProvider;
}
