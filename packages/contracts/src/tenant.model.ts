import { IRelationalImageAsset } from './image-asset.model';
import { IImportRecord } from './import-export.model';
import { IFeatureOrganization } from './feature.model';
import {
	FileStorageProviderEnum,
	ICloudinaryFileStorageProviderConfig,
	IS3FileStorageProviderConfig,
	IWasabiFileStorageProviderConfig
} from './file-provider';
import { IOrganization } from './organization.model';
import { IRolePermission } from './role-permission.model';
import { IBaseEntityModel, ID } from './base-entity.model';

export interface ITenant extends IBaseEntityModel, IRelationalImageAsset {
	name?: string;
	logo?: string;
	standardWorkHoursPerDay?: number;
	organizations?: IOrganization[];
	rolePermissions?: IRolePermission[];
	featureOrganizations?: IFeatureOrganization[];
	importRecords?: IImportRecord[];
}

export interface ITenantCreateInput extends ITenantUpdateInput {
	isImporting?: boolean;
	sourceId?: string;
	userSourceId?: ID;
}

export interface ITenantUpdateInput extends IRelationalImageAsset {
	name: string;
	logo?: string;
}

export interface ITenantSetting
	extends IS3FileStorageProviderConfig,
		IWasabiFileStorageProviderConfig,
		ICloudinaryFileStorageProviderConfig {
	fileStorageProvider?: FileStorageProviderEnum;
}
