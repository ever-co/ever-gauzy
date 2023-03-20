import { FileStorageProviderEnum } from "./file-provider";
import { IBasePerTenantAndOrganizationEntityModel } from "./base-entity.model";

export interface IImageAsset extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	url: string;
	thumb?: string;
	fullUrl?: string;
	thumbUrl?: string;
	width: number;
	height: number;
	size?: number;
	isFeatured: boolean;
	externalProviderId?: string;
	storageProvider?: FileStorageProviderEnum;
}
